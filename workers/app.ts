import { Hono } from "hono";
import { createRequestHandler } from "react-router";

import { apiApp } from "./lauralink-api";

const HSTS_MAX_AGE_SECONDS = 31536000;
const SECURITY_TXT_MAX_AGE_DAYS = 180;

const app = new Hono();

app.use("*", async (c, next) => {
	await next();

	applySecurityHeaders(c.req.raw, c.res.headers);
});

app.get("/security.txt", (c) => c.redirect("/.well-known/security.txt", 308));

app.get("/.well-known/security.txt", (c) => {
	return c.body(buildSecurityTxt(c.req.raw), 200, {
		"Content-Type": "text/plain; charset=utf-8",
		"Cache-Control": "public, max-age=3600",
	});
});

app.route("/api", apiApp);

app.all("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);

	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx },
	});
});

export default app;

function applySecurityHeaders(request: Request, headers: Headers) {
	if (new URL(request.url).protocol === "https:") {
		headers.set(
			"Strict-Transport-Security",
			`max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
		);
	}

	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Referrer-Policy", "no-referrer");
	headers.set(
		"Permissions-Policy",
		[
			"accelerometer=()",
			"camera=()",
			"geolocation=()",
			"gyroscope=()",
			"magnetometer=()",
			"microphone=()",
			"payment=()",
			"usb=()",
		].join(", "),
	);
}

function buildSecurityTxt(request: Request) {
	const url = new URL(request.url);
	const expiresAt = new Date(
		Date.now() + SECURITY_TXT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();
	const contact = `mailto:security@${url.host}`;

	return [
		"# Lauralink vulnerability disclosure",
		`Contact: ${contact}`,
		`Canonical: ${url.origin}/.well-known/security.txt`,
		"Preferred-Languages: pt-BR, en",
		`Expires: ${expiresAt}`,
	].join("\n");
}
