import { createCookieSessionStorage } from "react-router";

import { UNLOCK_SESSION_MAX_AGE_SECONDS } from "../app/lib/files";

export type RuntimeEnv = Env & {
	SHARE_SESSION_SECRET?: string;
};

type ShareSessionData = {
	unlockedShareIds?: string[];
};

export async function isShareUnlocked(
	request: Request,
	env: RuntimeEnv,
	shareId: string,
): Promise<boolean> {
	const session = await getShareSession(request, env);
	return session.get("unlockedShareIds")?.includes(shareId) ?? false;
}

export async function commitUnlockedShareSession(
	request: Request,
	env: RuntimeEnv,
	shareId: string,
): Promise<string> {
	const sessionStorage = getShareSessionStorage(env);
	const session = await sessionStorage.getSession(request.headers.get("Cookie"));
	const unlockedShareIds = new Set(session.get("unlockedShareIds") ?? []);

	unlockedShareIds.add(shareId);
	session.set("unlockedShareIds", Array.from(unlockedShareIds));

	return sessionStorage.commitSession(session, {
		maxAge: UNLOCK_SESSION_MAX_AGE_SECONDS,
		secure: new URL(request.url).protocol === "https:",
	});
}

function getShareSessionStorage(env: RuntimeEnv) {
	const secret = env.SHARE_SESSION_SECRET;

	if (!secret) {
		throw new Error(
			"SHARE_SESSION_SECRET is required for password-protected shares.",
		);
	}

	return createCookieSessionStorage<ShareSessionData>({
		cookie: {
			name: "__lauralink_share_unlock",
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secrets: [secret],
		},
	});
}

async function getShareSession(request: Request, env: RuntimeEnv) {
	const sessionStorage = getShareSessionStorage(env);
	return sessionStorage.getSession(request.headers.get("Cookie"));
}
