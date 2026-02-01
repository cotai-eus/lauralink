import { z } from "zod";
import type { UploadIntentRequest, UploadIntentResponse } from "../entities/file";
import { FileRepository } from "../../infra/d1/repositories";
import { R2Presigner } from "../../infra/r2/presigner";

// Zod schema for input validation
// Max file size: 20MB (Cloudflare Free tier optimized)
export const uploadIntentSchema = z.object({
    filename: z.string().min(1).max(255),
    size: z.number().positive().max(20 * 1024 * 1024), // 20MB max
    contentType: z.string().min(1),
    expiresInHours: z.number().positive().optional(),
});

// Plan limits (storage in bytes)
// Cloudflare R2 Free: 10GB total, so limits adjusted accordingly
const PLAN_LIMITS = {
    free: 500 * 1024 * 1024, // 500MB per user (free tier)
    pro: 5 * 1024 * 1024 * 1024, // 5GB per user
    enterprise: 10 * 1024 * 1024 * 1024, // 10GB per user (R2 free limit)
};

export interface UploadIntentDeps {
    fileRepo: FileRepository;
    r2Presigner: R2Presigner;
}

export interface UploadIntentContext {
    userId: string | null;
    userPlan: "free" | "pro" | "enterprise";
    userStorageUsed: number;
}

/**
 * Use Case: Generate Upload Intent
 * 
 * 1. Validates input
 * 2. Checks user quota (if authenticated)
 * 3. Creates pending file record in D1
 * 4. Generates presigned URL for R2
 * 
 * Returns uploadUrl and fileId for client-side upload.
 */
export async function executeUploadIntent(
    input: UploadIntentRequest,
    context: UploadIntentContext,
    deps: UploadIntentDeps
): Promise<UploadIntentResponse> {
    // Validate input
    const validated = uploadIntentSchema.parse(input);

    // Check quota for authenticated users
    if (context.userId) {
        const limit = PLAN_LIMITS[context.userPlan];
        if (context.userStorageUsed + validated.size > limit) {
            throw new Error("QUOTA_EXCEEDED");
        }
    }

    // Generate unique file ID and R2 key
    const fileId = crypto.randomUUID();
    const r2Key = context.userId
        ? `users/${context.userId}/${fileId}`
        : `anonymous/${fileId}`;

    // Calculate expiration (default 30 days for free, null for pro+)
    let expiresAt: number | null = null;
    if (validated.expiresInHours) {
        expiresAt = Math.floor(Date.now() / 1000) + validated.expiresInHours * 3600;
    } else if (context.userPlan === "free") {
        // Free tier: 30 days default expiration
        expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    }

    // Sanitize filename (remove path components, limit length)
    const sanitizedFilename = validated.filename
        .replace(/[/\\]/g, "_")
        .substring(0, 200);

    // Create pending file record
    await deps.fileRepo.createPendingFile({
        id: fileId,
        userId: context.userId,
        r2Key,
        filename: sanitizedFilename,
        sizeBytes: validated.size,
        mimeType: validated.contentType,
        isPublic: true,
        expiresAt,
    });

    // Generate presigned upload URL (5 minute TTL)
    const uploadUrl = await deps.r2Presigner.generateUploadUrl(
        r2Key,
        validated.contentType,
        300
    );

    return {
        fileId,
        uploadUrl,
        expiresAt: expiresAt || 0,
    };
}
