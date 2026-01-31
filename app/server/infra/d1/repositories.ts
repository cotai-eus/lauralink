import type { FileEntity, User } from "../../core/entities/file";

// D1 row types (snake_case from database)
interface FileRow {
    id: string;
    user_id: string | null;
    r2_key: string;
    filename: string;
    size_bytes: number;
    mime_type: string;
    status: "pending" | "active" | "deleted";
    is_public: number;
    expires_at: number | null;
    downloads_count: number;
    created_at: number;
}

interface UserRow {
    id: string;
    email: string;
    plan_tier: "free" | "pro" | "enterprise";
    storage_used_bytes: number;
    created_at: number;
}

export class FileRepository {
    constructor(private db: D1Database) { }

    async createPendingFile(file: Omit<FileEntity, "downloadsCount" | "createdAt" | "status">): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO files (id, user_id, r2_key, filename, size_bytes, mime_type, status, is_public, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
            )
            .bind(
                file.id,
                file.userId,
                file.r2Key,
                file.filename,
                file.sizeBytes,
                file.mimeType,
                file.isPublic ? 1 : 0,
                file.expiresAt
            )
            .run();
    }

    async activateFile(fileId: string): Promise<boolean> {
        const result = await this.db
            .prepare(`UPDATE files SET status = 'active' WHERE id = ? AND status = 'pending'`)
            .bind(fileId)
            .run();
        return result.meta.changes > 0;
    }

    async markDeleted(fileId: string): Promise<boolean> {
        const result = await this.db
            .prepare(`UPDATE files SET status = 'deleted' WHERE id = ?`)
            .bind(fileId)
            .run();
        return result.meta.changes > 0;
    }

    async getById(fileId: string): Promise<FileEntity | null> {
        const row = await this.db
            .prepare(`SELECT * FROM files WHERE id = ? AND status != 'deleted'`)
            .bind(fileId)
            .first<FileRow>();

        return row ? this.mapRowToEntity(row) : null;
    }

    async listByUser(userId: string, page = 1, pageSize = 20): Promise<{ files: FileEntity[]; total: number }> {
        const offset = (page - 1) * pageSize;

        const [filesResult, countResult] = await Promise.all([
            this.db
                .prepare(
                    `SELECT * FROM files 
           WHERE user_id = ? AND status = 'active' 
           ORDER BY created_at DESC 
           LIMIT ? OFFSET ?`
                )
                .bind(userId, pageSize, offset)
                .all<FileRow>(),
            this.db
                .prepare(`SELECT COUNT(*) as count FROM files WHERE user_id = ? AND status = 'active'`)
                .bind(userId)
                .first<{ count: number }>(),
        ]);

        return {
            files: (filesResult.results || []).map((row) => this.mapRowToEntity(row)),
            total: countResult?.count || 0,
        };
    }

    async getExpiredFiles(): Promise<FileEntity[]> {
        const now = Math.floor(Date.now() / 1000);
        const result = await this.db
            .prepare(
                `SELECT * FROM files 
         WHERE expires_at IS NOT NULL 
         AND expires_at < ? 
         AND status = 'active'`
            )
            .bind(now)
            .all<FileRow>();

        return (result.results || []).map((row) => this.mapRowToEntity(row));
    }

    async incrementDownloads(fileId: string): Promise<void> {
        await this.db
            .prepare(`UPDATE files SET downloads_count = downloads_count + 1 WHERE id = ?`)
            .bind(fileId)
            .run();
    }

    async logAccess(fileId: string, ip: string | null, userAgent: string | null, countryCode: string | null): Promise<void> {
        const logId = crypto.randomUUID();
        await this.db
            .prepare(
                `INSERT INTO access_logs (id, file_id, ip_address, user_agent, country_code)
         VALUES (?, ?, ?, ?, ?)`
            )
            .bind(logId, fileId, ip, userAgent, countryCode)
            .run();
    }

    private mapRowToEntity(row: FileRow): FileEntity {
        return {
            id: row.id,
            userId: row.user_id,
            r2Key: row.r2_key,
            filename: row.filename,
            sizeBytes: row.size_bytes,
            mimeType: row.mime_type,
            status: row.status,
            isPublic: row.is_public === 1,
            expiresAt: row.expires_at,
            downloadsCount: row.downloads_count,
            createdAt: row.created_at,
        };
    }
}

export class UserRepository {
    constructor(private db: D1Database) { }

    async getById(userId: string): Promise<User | null> {
        const row = await this.db
            .prepare(`SELECT * FROM users WHERE id = ?`)
            .bind(userId)
            .first<UserRow>();

        return row ? this.mapRowToEntity(row) : null;
    }

    async getByEmail(email: string): Promise<User | null> {
        const row = await this.db
            .prepare(`SELECT * FROM users WHERE email = ?`)
            .bind(email)
            .first<UserRow>();

        return row ? this.mapRowToEntity(row) : null;
    }

    async create(user: Omit<User, "storageUsedBytes" | "createdAt">): Promise<void> {
        await this.db
            .prepare(`INSERT INTO users (id, email, plan_tier) VALUES (?, ?, ?)`)
            .bind(user.id, user.email, user.planTier)
            .run();
    }

    async updateStorageUsed(userId: string, deltaBytes: number): Promise<void> {
        await this.db
            .prepare(`UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`)
            .bind(deltaBytes, userId)
            .run();
    }

    private mapRowToEntity(row: UserRow): User {
        return {
            id: row.id,
            email: row.email,
            planTier: row.plan_tier,
            storageUsedBytes: row.storage_used_bytes,
            createdAt: row.created_at,
        };
    }
}
