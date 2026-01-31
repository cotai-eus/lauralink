import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { filesApi } from "../app/server/adapters/http/files";
import { UploadRateLimiter } from "./rate-limiter";

const app = new Hono();

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

