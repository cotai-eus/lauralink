import { apiApp } from "../../workers/lauralink-api";
import type { RuntimeEnv } from "../../workers/share-session";

export type CloudflareContext = {
	env: RuntimeEnv;
	ctx: ExecutionContext;
};

export function callInternalApi(request: Request, cloudflare: CloudflareContext) {
	const url = new URL(request.url);
	url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

	return apiApp.fetch(new Request(url, request), cloudflare.env, cloudflare.ctx);
}

export function toCloudflareContext(cloudflare: unknown): CloudflareContext {
	return cloudflare as CloudflareContext;
}

export function forwardInternalCookies(response: Response): Headers | undefined {
	const setCookie = response.headers.get("Set-Cookie");

	if (!setCookie) {
		return undefined;
	}

	const headers = new Headers();
	headers.set("Set-Cookie", setCookie);
	return headers;
}
