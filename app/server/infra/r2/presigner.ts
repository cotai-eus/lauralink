import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2PresignerConfig {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
}

/**
 * R2Presigner uses the S3-compatible API to generate presigned URLs
 * for direct browser uploads and downloads, bypassing the Worker.
 */
export class R2Presigner {
    private client: S3Client;
    private bucketName: string;

    constructor(config: R2PresignerConfig) {
        // Validate configuration
        if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
            throw new Error(
                `Invalid R2 configuration: missing credentials. ` +
                `accountId: ${config.accountId ? "present" : "missing"}, ` +
                `accessKeyId: ${config.accessKeyId ? "present" : "missing"}, ` +
                `secretAccessKey: ${config.secretAccessKey ? "present" : "missing"}, ` +
                `bucketName: ${config.bucketName ? "present" : "missing"}`
            );
        }

        this.bucketName = config.bucketName;
        this.client = new S3Client({
            region: "auto",
            endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
            forcePathStyle: true,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }

    /**
     * Generate a presigned URL for uploading a file directly to R2.
     * The browser will PUT to this URL.
     * NOTE: ContentType is NOT included in the signature because browsers
     * may override it or not send it, causing signature mismatch.
     * R2 will accept uploads without Content-Type check.
     */
    async generateUploadUrl(
        key: string,
        contentType: string,
        expiresInSeconds = 300
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            // Note: We intentionally do NOT include ContentType in the command
            // This allows the client to upload without Content-Type headers
            // and avoid signature mismatches
        });

        return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }

    /**
     * Generate a presigned URL for downloading a file from R2.
     * Short TTL for security.
     */
    async generateDownloadUrl(
        key: string,
        filename: string,
        expiresInSeconds = 900
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
        });

        return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }

    /**
     * Check if a file exists in R2 (used to verify upload completion).
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await this.client.send(command);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Factory function to create R2Presigner from Cloudflare Worker environment.
 * Expects secrets: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * R2_BUCKET_NAME comes from wrangler.jsonc vars (defaults to 'lauralink')
 */
export function createR2Presigner(env: {
    R2_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_BUCKET_NAME: string;
}): R2Presigner {
    return new R2Presigner({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucketName: env.R2_BUCKET_NAME,
    });
}
