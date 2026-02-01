import { Hono } from "hono";
import { cors } from "hono/cors";
import { executeUploadIntent, uploadIntentSchema } from "../../core/usecases/upload-intent";
import { executeFinalizeUpload } from "../../core/usecases/finalize-upload";
import { executeGetFile } from "../../core/usecases/get-file";
import { executeListFiles } from "../../core/usecases/list-files";
import { FileRepository, UserRepository } from "../../infra/d1/repositories";
import { createR2Presigner } from "../../infra/r2/presigner";
import { ZodError } from "zod";

// Type for Cloudflare Worker environment bindings
interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    R2_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_BUCKET_NAME: string;
    RATE_LIMITER: DurableObjectNamespace;
    RATE_LIMIT_UPLOADS_PER_MINUTE?: string;
    RATE_LIMIT_DOWNLOADS_PER_MINUTE?: string;
}

// Create the Hono app for API routes
const api = new Hono<{ Bindings: Env }>();

// Apply CORS middleware to allow browser requests from configured origins
api.use(
    "*",
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:8787",
            "https://lauralink.qzz.io",
        ],
        allowHeaders: [
            "Content-Type",
            "Content-MD5",
            "x-amz-algorithm",
            "x-amz-credential",
            "x-amz-date",
            "x-amz-expires",
            "x-amz-signature",
            "x-amz-signed-headers",
            "x-amz-checksum-crc32",
            "x-amz-sdk-checksum-algorithm",
        ],
        exposeHeaders: ["ETag"],
        credentials: true,
        maxAge: 3600,
    })
);

/**
 * Rate limiting helper using Durable Objects
 */
async function checkRateLimit(
    rateLimiterNS: DurableObjectNamespace,
    identifier: string,
    limit: number,
    windowSeconds: number
): Promise<{ allowed: boolean; count: number }> {
    try {
        const id = rateLimiterNS.idFromName(identifier);
        const stub = rateLimiterNS.get(id);
        const response = await stub.fetch(new Request("https://rate-limiter/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit, windowSeconds }),
        }));
        return await response.json();
    } catch (error) {
        // If rate limiter fails, allow the request (fail open)
        console.error("[RATE_LIMITER] Error:", error);
        return { allowed: true, count: 0 };
    }
}

/**
 * Error handler helper
 */
function handleError(error: unknown) {
    if (error instanceof ZodError) {
        return {
            error: "VALIDATION_ERROR",
            details: error.issues,
            status: 400,
        };
    }

    if (error instanceof Error) {
        const errorMap: Record<string, number> = {
            QUOTA_EXCEEDED: 402,
            FILE_NOT_FOUND: 404,
            ACCESS_DENIED: 403,
            FILE_EXPIRED: 410,
            R2_OBJECT_NOT_FOUND: 400,
        };
        return {
            error: error.message,
            status: errorMap[error.message] || 500,
        };
    }

    return { error: "INTERNAL_ERROR", status: 500 };
}

/**
 * POST /api/v1/files/upload-intent
 * 
 * Request body: { filename, size, contentType, expiresInHours? }
 * Response: { fileId, uploadUrl, expiresAt }
 */
api.post("/upload-intent", async (c) => {
    try {
        // Rate limiting by IP
        const ipAddress = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "anonymous";
        const uploadLimit = parseInt(c.env.RATE_LIMIT_UPLOADS_PER_MINUTE || "10", 10);
        
        if (c.env.RATE_LIMITER) {
            const rateCheck = await checkRateLimit(c.env.RATE_LIMITER, `upload:${ipAddress}`, uploadLimit, 60);
            if (!rateCheck.allowed) {
                return c.json({ 
                    error: "RATE_LIMITED",
                    message: `Too many uploads. Limit: ${uploadLimit} per minute. Try again later.`,
                    retryAfter: 60
                }, 429);
            }
        }

        const body = await c.req.json();

        // TODO: Extract from auth middleware when implemented
        const userId = c.req.header("X-User-Id") || null;
        const userPlan = "free" as const;
        const userStorageUsed = 0;

        const fileRepo = new FileRepository(c.env.DB);
        
        // Validate R2 credentials are configured
        if (!c.env.R2_ACCOUNT_ID || !c.env.R2_ACCESS_KEY_ID || !c.env.R2_SECRET_ACCESS_KEY) {
            console.error("[UPLOAD_INTENT] Missing R2 credentials:", {
                accountId: c.env.R2_ACCOUNT_ID ? "present" : "missing",
                accessKeyId: c.env.R2_ACCESS_KEY_ID ? "present" : "missing",
                secretAccessKey: c.env.R2_SECRET_ACCESS_KEY ? "present" : "missing",
            });
            return c.json({ error: "R2_CREDENTIALS_NOT_CONFIGURED" }, 500);
        }
        
        const r2Presigner = createR2Presigner({
            R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
            R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
            R2_BUCKET_NAME: c.env.R2_BUCKET_NAME,
        });

        const result = await executeUploadIntent(
            body,
            { userId, userPlan, userStorageUsed },
            { fileRepo, r2Presigner }
        );

        return c.json(result, 200);
    } catch (error) {
        const { error: msg, status } = handleError(error);
        console.error("[UPLOAD_INTENT] Error:", error);
        return c.json({ error: msg }, status as 400);
    }
});

/**
 * PUT /api/v1/files/:id/upload
 * 
 * Receive file upload from browser and proxy to R2.
 * This endpoint avoids CORS issues by uploading through the Worker.
 * Response: { success, error? }
 */
api.put("/:id/upload", async (c) => {
    try {
        const fileId = c.req.param("id");
        
        // Get the raw body (file content)
        const buffer = await c.req.arrayBuffer();
        
        if (!buffer || buffer.byteLength === 0) {
            return c.json({ error: "Empty file" }, 400);
        }

        // Get file metadata from headers
        const contentType = c.req.header("Content-Type") || "application/octet-stream";
        
        // Upload to R2 using the Worker's R2 binding
        const userId = c.req.header("X-User-Id") || null;
        const r2Key = userId
            ? `users/${userId}/${fileId}`
            : `anonymous/${fileId}`;

        try {
            await c.env.BUCKET.put(r2Key, buffer, {
                httpMetadata: {
                    contentType: contentType,
                },
            });

            return c.json({ success: true }, 200);
        } catch (r2Error) {
            console.error("[UPLOAD_FILE] R2 error:", r2Error);
            return c.json({ error: "Failed to upload to R2", details: String(r2Error) }, 500);
        }
    } catch (error) {
        console.error("[UPLOAD_FILE] Error:", error);
        const { error: msg, status } = handleError(error);
        return c.json({ error: msg }, status as 400);
    }
});

/**
 * POST /api/v1/files/:id/finalize
 * 
 * Called after client completes R2 upload.
 * Response: { success, downloadUrl? }
 */
api.post("/:id/finalize", async (c) => {
    try {
        const fileId = c.req.param("id");

        const fileRepo = new FileRepository(c.env.DB);
        const r2Presigner = createR2Presigner({
            R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
            R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
            R2_BUCKET_NAME: c.env.R2_BUCKET_NAME,
        });

        const result = await executeFinalizeUpload(fileId, {
            fileRepo,
            r2Presigner,
            r2Bucket: c.env.BUCKET,
        });

        if (!result.success) {
            const status = result.error === "FILE_NOT_FOUND" ? 404 : 400;
            return c.json({ error: result.error }, status);
        }

        return c.json(result, 200);
    } catch (error) {
        const { error: msg, status } = handleError(error);
        return c.json({ error: msg }, status as 400);
    }
});

/**
 * GET /api/v1/files/:id
 * 
 * Get file metadata and download URL.
 * Response: { file, downloadUrl } or redirect (302)
 */
api.get("/:id", async (c) => {
    try {
        const fileId = c.req.param("id");
        const redirect = c.req.query("redirect") === "true";

        const userId = c.req.header("X-User-Id") || null;
        const ipAddress = c.req.header("CF-Connecting-IP") || null;
        const userAgent = c.req.header("User-Agent") || null;
        const countryCode = c.req.header("CF-IPCountry") || null;

        const fileRepo = new FileRepository(c.env.DB);
        const r2Presigner = createR2Presigner({
            R2_ACCOUNT_ID: c.env.R2_ACCOUNT_ID,
            R2_ACCESS_KEY_ID: c.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: c.env.R2_SECRET_ACCESS_KEY,
            R2_BUCKET_NAME: c.env.R2_BUCKET_NAME,
        });

        const result = await executeGetFile(
            fileId,
            { userId, ipAddress, userAgent, countryCode },
            { fileRepo, r2Presigner }
        );

        if (redirect) {
            return c.redirect(result.downloadUrl, 302);
        }

        return c.json(result, 200);
    } catch (error) {
        const { error: msg, status } = handleError(error);
        return c.json({ error: msg }, status as 400);
    }
});

/**
 * GET /api/v1/files
 * 
 * List user's files (requires auth).
 * Query params: page, pageSize
 * Response: { files, total, page, pageSize }
 */
api.get("/", async (c) => {
    try {
        const userId = c.req.header("X-User-Id");

        if (!userId) {
            return c.json({ error: "UNAUTHORIZED" }, 401);
        }

        const page = parseInt(c.req.query("page") || "1", 10);
        const pageSize = parseInt(c.req.query("pageSize") || "20", 10);

        const fileRepo = new FileRepository(c.env.DB);

        const result = await executeListFiles(userId, page, pageSize, { fileRepo });

        return c.json(result, 200);
    } catch (error) {
        const { error: msg, status } = handleError(error);
        return c.json({ error: msg }, status as 400);
    }
});

export { api as filesApi };
