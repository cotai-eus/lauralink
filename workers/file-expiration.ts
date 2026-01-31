/**
 * FileExpirationDO - Durable Object for automatic file cleanup
 *
 * This DO uses alarms to automatically delete expired files.
 * When a file with expiration is created, an alarm is scheduled.
 * When the alarm fires, the file is deleted from R2 and marked as deleted in D1.
 */

interface ExpiringFile {
    fileId: string;
    r2Key: string;
    expiresAt: number;
}

export class FileExpirationDO implements DurableObject {
    private state: DurableObjectState;
    private env: Record<string, unknown>;

    constructor(state: DurableObjectState, env: Record<string, unknown>) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // POST /schedule - Schedule a file for expiration
        if (url.pathname === "/schedule" && request.method === "POST") {
            const body = (await request.json()) as ExpiringFile;
            return this.scheduleExpiration(body);
        }

        // POST /cancel - Cancel a scheduled expiration
        if (url.pathname === "/cancel" && request.method === "POST") {
            const body = (await request.json()) as { fileId: string };
            return this.cancelExpiration(body.fileId);
        }

        // GET /status - Get current expiration status
        if (url.pathname === "/status" && request.method === "GET") {
            return this.getStatus();
        }

        return new Response("Not found", { status: 404 });
    }

    private async scheduleExpiration(file: ExpiringFile): Promise<Response> {
        // Store file info for later deletion
        await this.state.storage.put(`file:${file.fileId}`, file);

        // Get all scheduled files to find the next alarm time
        const allFiles = await this.getAllScheduledFiles();
        allFiles.push(file);

        // Sort by expiration time and set alarm to the nearest one
        allFiles.sort((a, b) => a.expiresAt - b.expiresAt);
        const nextExpiration = allFiles[0].expiresAt * 1000; // Convert to ms

        await this.state.storage.setAlarm(nextExpiration);

        return Response.json({
            success: true,
            nextAlarm: new Date(nextExpiration).toISOString(),
        });
    }

    private async cancelExpiration(fileId: string): Promise<Response> {
        await this.state.storage.delete(`file:${fileId}`);

        // Recalculate next alarm
        const allFiles = await this.getAllScheduledFiles();
        if (allFiles.length > 0) {
            allFiles.sort((a, b) => a.expiresAt - b.expiresAt);
            await this.state.storage.setAlarm(allFiles[0].expiresAt * 1000);
        } else {
            await this.state.storage.deleteAlarm();
        }

        return Response.json({ success: true });
    }

    private async getStatus(): Promise<Response> {
        const alarm = await this.state.storage.getAlarm();
        const files = await this.getAllScheduledFiles();

        return Response.json({
            scheduledFiles: files.length,
            nextAlarm: alarm ? new Date(alarm).toISOString() : null,
        });
    }

    /**
     * Alarm handler - called when a scheduled alarm fires.
     * Processes all expired files.
     */
    async alarm(): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        const allFiles = await this.getAllScheduledFiles();

        // Find expired files
        const expired = allFiles.filter((f) => f.expiresAt <= now);
        const remaining = allFiles.filter((f) => f.expiresAt > now);

        // Process expired files
        for (const file of expired) {
            try {
                // Delete from R2
                const bucket = this.env.BUCKET as R2Bucket;
                if (bucket) {
                    await bucket.delete(file.r2Key);
                }

                // Mark as deleted in D1
                const db = this.env.DB as D1Database;
                if (db) {
                    await db
                        .prepare(`UPDATE files SET status = 'deleted' WHERE id = ?`)
                        .bind(file.fileId)
                        .run();
                }

                // Remove from storage
                await this.state.storage.delete(`file:${file.fileId}`);
            } catch (error) {
                console.error(`Failed to delete file ${file.fileId}:`, error);
                // Keep the file in storage to retry later
            }
        }

        // Set next alarm if there are remaining files
        if (remaining.length > 0) {
            remaining.sort((a, b) => a.expiresAt - b.expiresAt);
            await this.state.storage.setAlarm(remaining[0].expiresAt * 1000);
        }
    }

    private async getAllScheduledFiles(): Promise<ExpiringFile[]> {
        const entries = await this.state.storage.list<ExpiringFile>({
            prefix: "file:",
        });
        return Array.from(entries.values());
    }
}
