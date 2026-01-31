import { FileRepository } from "../../infra/d1/repositories";
import { R2Presigner } from "../../infra/r2/presigner";
import type { FileEntity } from "../entities/file";

export interface GetFileDeps {
    fileRepo: FileRepository;
    r2Presigner: R2Presigner;
}

export interface GetFileContext {
    userId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    countryCode: string | null;
}

export interface GetFileResult {
    file: FileEntity;
    downloadUrl: string;
}

/**
 * Use Case: Get File for Download
 * 
 * 1. Fetches file metadata
 * 2. Checks permissions (public or owned by user)
 * 3. Checks expiration
 * 4. Logs access
 * 5. Returns presigned download URL
 */
export async function executeGetFile(
    fileId: string,
    context: GetFileContext,
    deps: GetFileDeps
): Promise<GetFileResult> {
    // Get file metadata
    const file = await deps.fileRepo.getById(fileId);

    if (!file) {
        throw new Error("FILE_NOT_FOUND");
    }

    // Check if file is accessible
    if (!file.isPublic && file.userId !== context.userId) {
        throw new Error("ACCESS_DENIED");
    }

    // Check expiration
    if (file.expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        if (now > file.expiresAt) {
            throw new Error("FILE_EXPIRED");
        }
    }

    // Log access (fire and forget)
    deps.fileRepo.logAccess(
        fileId,
        context.ipAddress,
        context.userAgent,
        context.countryCode
    ).catch(() => { }); // Don't fail if logging fails

    // Increment download count
    deps.fileRepo.incrementDownloads(fileId).catch(() => { });

    // Generate download URL
    const downloadUrl = await deps.r2Presigner.generateDownloadUrl(
        file.r2Key,
        file.filename,
        900 // 15 minutes
    );

    return { file, downloadUrl };
}
