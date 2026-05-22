export const MAX_FILES_PER_SHARE = 10;
export const MAX_TOTAL_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_UPLOAD_LABEL = "50 MiB";
export const UNLOCK_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const PASSWORD_PBKDF2_ITERATIONS = 120_000;

export type ShareFileSummary = {
	id: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	downloadUrl: string;
};

export type ShareMetadata = {
	id: string;
	shareUrl: string;
	qrSvg: string;
	totalSizeBytes: number;
	fileCount: number;
	createdAt: string;
	isPasswordProtected: boolean;
	isUnlocked: boolean;
	files: ShareFileSummary[];
};

export type UploadResponse = {
	share: ShareMetadata;
};

export type LegacyFileMetadata = {
	id: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	uploadedAt: string;
	downloadUrl: string;
};

export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}
