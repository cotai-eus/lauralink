import { FileRepository } from "../../infra/d1/repositories";
import { R2Presigner } from "../../infra/r2/presigner";

export interface FinalizeUploadDeps {
    fileRepo: FileRepository;
    r2Presigner: R2Presigner;
    r2Bucket: R2Bucket;
}

export interface FinalizeUploadResult {
    success: boolean;
    downloadUrl?: string;
    error?: string;
}

/**
 * Use Case: Finalize Upload
 * 
 * Called after client completes direct R2 upload.
 * 1. Verifies file exists in R2
 * 2. Updates D1 status from 'pending' to 'active'
 * 3. Returns download URL
 */
export async function executeFinalizeUpload(
    fileId: string,
    deps: FinalizeUploadDeps
): Promise<FinalizeUploadResult> {
    // Get file metadata from D1
    const file = await deps.fileRepo.getById(fileId);

    if (!file) {
        return { success: false, error: "FILE_NOT_FOUND" };
    }

    if (file.status !== "pending") {
        return { success: false, error: "FILE_ALREADY_FINALIZED" };
    }

    // Verify file exists in R2 using both methods for debugging
    console.log("[DEBUG] Checking if file exists in R2:", file.r2Key);
    
    // Add a small delay to ensure file is available (eventual consistency)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try native binding first
    console.log("[DEBUG] Trying native R2 binding...");
    let r2Object = await deps.r2Bucket.head(file.r2Key);
    console.log("[DEBUG] Native binding result:", r2Object ? "Found" : "Not found");

    // If not found with native binding, try S3 SDK method
    if (!r2Object) {
        console.log("[DEBUG] File not found via native binding, trying S3 SDK...");
        const existsViaSdk = await deps.r2Presigner.fileExists(file.r2Key);
        console.log("[DEBUG] S3 SDK result:", existsViaSdk ? "Found" : "Not found");
        
        if (!existsViaSdk) {
            console.log("[DEBUG] File not found in R2 after upload via both methods");
            return { success: false, error: "R2_OBJECT_NOT_FOUND" };
        }
    }

    // Activate the file
    const updated = await deps.fileRepo.activateFile(fileId);

    if (!updated) {
        return { success: false, error: "UPDATE_FAILED" };
    }

    // Generate short-lived download URL for immediate use
    const downloadUrl = await deps.r2Presigner.generateDownloadUrl(
        file.r2Key,
        file.filename,
        900 // 15 minutes
    );

    return {
        success: true,
        downloadUrl,
    };
}
