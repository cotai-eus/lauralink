import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRequestHandler } from "react-router";
import { filesApi } from "../app/server/adapters/http/files";
import { UploadRateLimiter } from "./rate-limiter";

const app = new Hono();

// Apply CORS middleware globally for all routes
app.use(
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

// Mount API routes
app.route("/api/v1/files", filesApi);

// Health check endpoint
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// Ignore Chrome DevTools well-known requests to clean up logs
app.get("/.well-known/*", (c) => c.notFound());

// All other routes go to React Router (SSR)
app.get("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

// Export Durable Object classes
export { UploadRateLimiter };
export { FileExpirationDO } from "./file-expiration";

export default app;

