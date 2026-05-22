import { Hono, type Context } from "hono";

import {
	MAX_FILES_PER_SHARE,
	MAX_TOTAL_UPLOAD_BYTES,
	MAX_TOTAL_UPLOAD_LABEL,
	type LegacyFileMetadata,
	type ShareFileSummary,
	type ShareMetadata,
	type UploadResponse,
} from "../app/lib/files";
import { createPasswordDigest, verifyPasswordDigest } from "./share-security";
import {
	commitUnlockedShareSession,
	isShareUnlocked,
	type RuntimeEnv,
} from "./share-session";

type AppEnv = {
	Bindings: RuntimeEnv;
};

type ApiContext = Context<AppEnv>;

type ShareRow = {
	id: string;
	total_size_bytes: number;
	file_count: number;
	password_salt: string | null;
	password_hash: string | null;
	password_iterations: number | null;
	created_at: string;
};

type ShareFileRow = {
	id: string;
	share_id: string;
	original_name: string;
	content_type: string;
	size_bytes: number;
	r2_key: string;
	sort_order: number;
	created_at: string;
};

type ShareWithFiles = {
	share: ShareRow;
	files: ShareFileRow[];
};

type PreparedUpload = {
	id: string;
	file: File;
	contentType: string;
	r2Key: string;
	sortOrder: number;
	createdAt: string;
};

type PasswordState = {
	salt: string;
	hash: string;
	iterations: number;
} | null;

const SHARE_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export const apiApp = new Hono<AppEnv>();

apiApp.post("/upload", async (c) => {
	try {
		const formData = await c.req.formData();
		const files = collectUploadedFiles(formData);
		const password = normalizePassword(formData.get("password"));
		const totalSizeBytes = validateUploadBatch(files);
		const shareId = await reserveShareId(c.env.FILES_DB);
		const createdAt = new Date().toISOString();
		const preparedUploads = files.map((file, index) => ({
			id: generateId(12),
			file,
			contentType: file.type || "application/octet-stream",
			r2Key: `shares/${shareId}/${generateId(16)}`,
			sortOrder: index,
			createdAt,
		}));
		const passwordState = password ? await createPasswordDigest(password) : null;

		await uploadFilesToR2(c.env.FILES_BUCKET, preparedUploads);

		try {
			await persistShare(c.env.FILES_DB, {
				id: shareId,
				totalSizeBytes,
				fileCount: preparedUploads.length,
				passwordState,
				createdAt,
				files: preparedUploads,
			});
		} catch (error) {
			await c.env.FILES_BUCKET.delete(preparedUploads.map((entry) => entry.r2Key));
			await deleteShare(c.env.FILES_DB, shareId);
			throw error;
		}

		const shareMetadata = toShareMetadata(
			{
				share: {
					id: shareId,
					total_size_bytes: totalSizeBytes,
					file_count: preparedUploads.length,
					password_salt: passwordState?.salt ?? null,
					password_hash: passwordState?.hash ?? null,
					password_iterations: passwordState?.iterations ?? null,
					created_at: createdAt,
				},
				files: preparedUploads.map((entry) => ({
					id: entry.id,
					share_id: shareId,
					original_name: entry.file.name,
					content_type: entry.contentType,
					size_bytes: entry.file.size,
					r2_key: entry.r2Key,
					sort_order: entry.sortOrder,
					created_at: entry.createdAt,
				})),
			},
			new URL(c.req.url).origin,
			true,
		);

		if (passwordState) {
			ensureShareSessionConfigured(c.env);
			c.header(
				"Set-Cookie",
				await commitUnlockedShareSession(c.req.raw, c.env, shareId),
			);
		}

		const payload: UploadResponse = {
			share: shareMetadata,
		};

		return c.json(payload, 201);
	} catch (error) {
		return handleApiError(c, error, "upload_failed");
	}
});

apiApp.get("/shares/:id", async (c) => {
	try {
		const shareBundle = await findShareWithFiles(c.env.FILES_DB, c.req.param("id"));

		if (!shareBundle) {
			throw new ApiError(404, "Share nao encontrado.");
		}

		const isUnlocked = await resolveShareUnlockState(c.req.raw, c.env, shareBundle.share);

		return c.json(toShareMetadata(shareBundle, new URL(c.req.url).origin, isUnlocked));
	} catch (error) {
		return handleApiError(c, error, "share_lookup_failed");
	}
});

apiApp.post("/shares/:id/unlock", async (c) => {
	try {
		const shareBundle = await findShareWithFiles(c.env.FILES_DB, c.req.param("id"));

		if (!shareBundle) {
			throw new ApiError(404, "Share nao encontrado.");
		}

		if (!isPasswordProtected(shareBundle.share)) {
			throw new ApiError(400, "Este link nao possui senha.");
		}

		ensureShareSessionConfigured(c.env);

		const formData = await c.req.formData();
		const password = formData.get("password");

		if (typeof password !== "string" || password.length === 0) {
			throw new ApiError(400, "Informe a senha para liberar os downloads.");
		}

		const passwordMatches = await verifyPasswordDigest(password, {
			salt: shareBundle.share.password_salt as string,
			hash: shareBundle.share.password_hash as string,
			iterations: shareBundle.share.password_iterations as number,
		});

		if (!passwordMatches) {
			throw new ApiError(401, "Senha incorreta.");
		}

		c.header(
			"Set-Cookie",
			await commitUnlockedShareSession(c.req.raw, c.env, shareBundle.share.id),
		);

		return c.json({ ok: true });
	} catch (error) {
		return handleApiError(c, error, "share_unlock_failed");
	}
});

apiApp.get("/shares/:id/files/:fileId/download", async (c) => {
	try {
		const shareBundle = await findShareWithFiles(c.env.FILES_DB, c.req.param("id"));

		if (!shareBundle) {
			throw new ApiError(404, "Share nao encontrado.");
		}

		const file = shareBundle.files.find(
			(entry) => entry.id === c.req.param("fileId"),
		);

		if (!file) {
			throw new ApiError(404, "Arquivo nao encontrado.");
		}

		await assertShareCanDownload(c.req.raw, c.env, shareBundle.share);

		return streamShareFile(c, shareBundle.share.id, file);
	} catch (error) {
		return handleApiError(c, error, "share_file_download_failed");
	}
});

apiApp.get("/files/:id", async (c) => {
	try {
		const shareBundle = await findShareWithFiles(c.env.FILES_DB, c.req.param("id"));

		if (!shareBundle || shareBundle.files.length !== 1) {
			throw new ApiError(404, "Arquivo nao encontrado.");
		}

		return c.json(
			toLegacyFileMetadata(
				shareBundle.share,
				shareBundle.files[0],
				new URL(c.req.url).origin,
			),
		);
	} catch (error) {
		return handleApiError(c, error, "legacy_file_lookup_failed");
	}
});

apiApp.get("/files/:id/download", async (c) => {
	try {
		const shareBundle = await findShareWithFiles(c.env.FILES_DB, c.req.param("id"));

		if (!shareBundle || shareBundle.files.length !== 1) {
			throw new ApiError(404, "Arquivo nao encontrado.");
		}

		await assertShareCanDownload(c.req.raw, c.env, shareBundle.share);

		return streamShareFile(c, shareBundle.share.id, shareBundle.files[0]);
	} catch (error) {
		return handleApiError(c, error, "legacy_file_download_failed");
	}
});

class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

function collectUploadedFiles(formData: FormData): File[] {
	const multipleFiles = formData
		.getAll("files")
		.filter((entry): entry is File => entry instanceof File);

	if (multipleFiles.length > 0) {
		return multipleFiles;
	}

	const legacyFile = formData.get("file");
	return legacyFile instanceof File ? [legacyFile] : [];
}

function validateUploadBatch(files: File[]): number {
	if (files.length === 0) {
		throw new ApiError(400, "Selecione pelo menos um arquivo antes de enviar.");
	}

	if (files.length > MAX_FILES_PER_SHARE) {
		throw new ApiError(400, "O limite desta versao e 10 arquivos por upload.");
	}

	let totalSizeBytes = 0;

	for (const file of files) {
		if (file.size === 0) {
			throw new ApiError(400, "Arquivos vazios nao podem ser compartilhados.");
		}

		totalSizeBytes += file.size;
	}

	if (totalSizeBytes > MAX_TOTAL_UPLOAD_BYTES) {
		throw new ApiError(
			413,
			`O limite desta versao e ${MAX_TOTAL_UPLOAD_LABEL} no total por upload.`,
		);
	}

	return totalSizeBytes;
}

function normalizePassword(entry: FormDataEntryValue | null): string | null {
	if (typeof entry !== "string") {
		return null;
	}

	return entry.length > 0 ? entry : null;
}

async function uploadFilesToR2(
	bucket: R2Bucket,
	files: PreparedUpload[],
): Promise<void> {
	const uploadedKeys: string[] = [];

	try {
		for (const entry of files) {
			await bucket.put(entry.r2Key, entry.file, {
				httpMetadata: {
					contentType: entry.contentType,
				},
			});
			uploadedKeys.push(entry.r2Key);
		}
	} catch (error) {
		if (uploadedKeys.length > 0) {
			await bucket.delete(uploadedKeys);
		}

		throw error;
	}
}

async function persistShare(
	db: D1Database,
	input: {
		id: string;
		totalSizeBytes: number;
		fileCount: number;
		passwordState: PasswordState;
		createdAt: string;
		files: PreparedUpload[];
	},
): Promise<void> {
	await db.batch([
		db.prepare(
			`
				INSERT INTO shares (
					id,
					total_size_bytes,
					file_count,
					password_salt,
					password_hash,
					password_iterations,
					created_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`,
		).bind(
			input.id,
			input.totalSizeBytes,
			input.fileCount,
			input.passwordState?.salt ?? null,
			input.passwordState?.hash ?? null,
			input.passwordState?.iterations ?? null,
			input.createdAt,
		),
		...input.files.map((entry) =>
			db.prepare(
				`
					INSERT INTO share_files (
						id,
						share_id,
						original_name,
						content_type,
						size_bytes,
						r2_key,
						sort_order,
						created_at
					)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`,
			).bind(
				entry.id,
				input.id,
				entry.file.name,
				entry.contentType,
				entry.file.size,
				entry.r2Key,
				entry.sortOrder,
				entry.createdAt,
			),
		),
	]);
}

async function reserveShareId(db: D1Database): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const candidate = generateId(10);
		const existing = await db
			.prepare("SELECT id FROM shares WHERE id = ?")
			.bind(candidate)
			.first<{ id: string }>();

		if (!existing) {
			return candidate;
		}
	}

	throw new Error("Unable to reserve a unique share id.");
}

function generateId(length: number): string {
	const randomBytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(
		randomBytes,
		(byte) => SHARE_ID_ALPHABET[byte % SHARE_ID_ALPHABET.length],
	).join("");
}

async function findShareWithFiles(
	db: D1Database,
	id: string,
): Promise<ShareWithFiles | null> {
	const share = await db
		.prepare(
			`
				SELECT
					id,
					total_size_bytes,
					file_count,
					password_salt,
					password_hash,
					password_iterations,
					created_at
				FROM shares
				WHERE id = ?
			`,
		)
		.bind(id)
		.first<ShareRow>();

	if (!share) {
		return null;
	}

	const filesResult = await db
		.prepare(
			`
				SELECT
					id,
					share_id,
					original_name,
					content_type,
					size_bytes,
					r2_key,
					sort_order,
					created_at
				FROM share_files
				WHERE share_id = ?
				ORDER BY sort_order ASC
			`,
		)
		.bind(id)
		.all<ShareFileRow>();

	return {
		share,
		files: filesResult.results,
	};
}

function toShareMetadata(
	shareBundle: ShareWithFiles,
	origin: string,
	isUnlocked: boolean,
): ShareMetadata {
	const shareUrl = `${origin}/f/${shareBundle.share.id}`;

	return {
		id: shareBundle.share.id,
		shareUrl,
		totalSizeBytes: shareBundle.share.total_size_bytes,
		fileCount: shareBundle.share.file_count,
		createdAt: shareBundle.share.created_at,
		isPasswordProtected: isPasswordProtected(shareBundle.share),
		isUnlocked,
		files: shareBundle.files.map((file) =>
			toShareFileSummary(file, origin, shareBundle.share.id),
		),
	};
}

function toShareFileSummary(
	file: ShareFileRow,
	origin: string,
	shareId: string,
): ShareFileSummary {
	return {
		id: file.id,
		fileName: file.original_name,
		contentType: file.content_type,
		sizeBytes: file.size_bytes,
		downloadUrl: `${origin}/api/shares/${shareId}/files/${file.id}/download`,
	};
}

function toLegacyFileMetadata(
	share: ShareRow,
	file: ShareFileRow,
	origin: string,
): LegacyFileMetadata {
	return {
		id: share.id,
		fileName: file.original_name,
		contentType: file.content_type,
		sizeBytes: file.size_bytes,
		uploadedAt: share.created_at,
		downloadUrl: `${origin}/api/files/${share.id}/download`,
	};
}

async function resolveShareUnlockState(
	request: Request,
	env: RuntimeEnv,
	share: ShareRow,
): Promise<boolean> {
	if (!isPasswordProtected(share)) {
		return true;
	}

	ensureShareSessionConfigured(env);
	return isShareUnlocked(request, env, share.id);
}

async function assertShareCanDownload(
	request: Request,
	env: RuntimeEnv,
	share: ShareRow,
): Promise<void> {
	if (!isPasswordProtected(share)) {
		return;
	}

	ensureShareSessionConfigured(env);

	if (!(await isShareUnlocked(request, env, share.id))) {
		throw new ApiError(403, "Senha necessaria para baixar este link.");
	}
}

function ensureShareSessionConfigured(env: RuntimeEnv): void {
	if (!env.SHARE_SESSION_SECRET) {
		throw new ApiError(
			500,
			"A protecao por senha nao esta configurada neste ambiente.",
		);
	}
}

function isPasswordProtected(share: ShareRow): boolean {
	return Boolean(
		share.password_hash &&
			share.password_salt &&
			typeof share.password_iterations === "number",
	);
}

async function streamShareFile(c: ApiContext, shareId: string, file: ShareFileRow) {
	const object = await c.env.FILES_BUCKET.get(file.r2_key);

	if (!object) {
		throw new ApiError(404, "O arquivo nao esta mais disponivel.");
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Content-Disposition", buildAttachmentDisposition(file.original_name));
	headers.set("Content-Length", object.size.toString());
	headers.set("Content-Type", file.content_type || "application/octet-stream");
	headers.set("ETag", object.httpEtag);
	headers.set("X-Lauralink-Share-Id", shareId);

	return new Response(object.body, {
		headers,
	});
}

async function deleteShare(db: D1Database, shareId: string): Promise<void> {
	await db.prepare("DELETE FROM shares WHERE id = ?").bind(shareId).run();
}

function buildAttachmentDisposition(fileName: string): string {
	const fallback = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "'");
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function handleApiError(c: ApiContext, error: unknown, label: string) {
	if (error instanceof ApiError) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: error.status,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	console.error(label, error);
	return new Response(
		JSON.stringify({ error: "Nao foi possivel concluir esta operacao agora." }),
		{
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
}
