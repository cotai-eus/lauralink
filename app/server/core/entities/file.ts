// Core entity types for Lauralink SaaS

export interface User {
    id: string;
    email: string;
    planTier: "free" | "pro" | "enterprise";
    storageUsedBytes: number;
    createdAt: number;
}

export interface FileEntity {
    id: string;
    userId: string | null;
    r2Key: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    status: "pending" | "active" | "deleted";
    isPublic: boolean;
    expiresAt: number | null;
    downloadsCount: number;
    createdAt: number;
}

export interface AccessLog {
    id: string;
    fileId: string;
    ipAddress: string | null;
    userAgent: string | null;
    countryCode: string | null;
    accessedAt: number;
}

// API Request/Response types
export interface UploadIntentRequest {
    filename: string;
    size: number;
    contentType: string;
    expiresInHours?: number;
}

export interface UploadIntentResponse {
    fileId: string;
    uploadUrl: string;
    expiresAt: number;
}

export interface FileListResponse {
    files: FileEntity[];
    total: number;
    page: number;
    pageSize: number;
}
