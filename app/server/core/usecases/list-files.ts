import { FileRepository } from "../../infra/d1/repositories";
import type { FileListResponse } from "../entities/file";

export interface ListFilesDeps {
    fileRepo: FileRepository;
}

/**
 * Use Case: List User Files
 * 
 * Returns paginated list of user's active files.
 */
export async function executeListFiles(
    userId: string,
    page: number,
    pageSize: number,
    deps: ListFilesDeps
): Promise<FileListResponse> {
    // Validate pagination
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));

    const { files, total } = await deps.fileRepo.listByUser(
        userId,
        safePage,
        safePageSize
    );

    return {
        files,
        total,
        page: safePage,
        pageSize: safePageSize,
    };
}
