import { useState, useRef, useCallback } from "react";
import { Link } from "react-router";

interface UploadState {
    status: "idle" | "preparing" | "uploading" | "finalizing" | "success" | "error";
    progress: number;
    fileId?: string;
    downloadUrl?: string;
    error?: string;
}

export default function UploadPage() {
    const [uploadState, setUploadState] = useState<UploadState>({
        status: "idle",
        progress: 0,
    });
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        setUploadState({ status: "preparing", progress: 0 });

        try {
            // Step 1: Get upload intent (presigned URL)
            const intentRes = await fetch("/api/v1/files/upload-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: file.name,
                    size: file.size,
                    contentType: file.type || "application/octet-stream",
                }),
            });

            if (!intentRes.ok) {
                const error = await intentRes.json();
                throw new Error(error.error || "Failed to prepare upload");
            }

            const { fileId, uploadUrl } = await intentRes.json();
            console.log("[DEBUG] Got upload URL for fileId:", fileId);
            setUploadState((prev) => ({ ...prev, status: "uploading" }));

            // Step 2: Upload directly to R2 using XMLHttpRequest for progress
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        setUploadState((prev) => ({ ...prev, progress }));
                    }
                });

                xhr.addEventListener("load", () => {
                    console.log("[DEBUG] XHR load event - status:", xhr.status);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log("[DEBUG] Upload to R2 succeeded for fileId:", fileId);
                        console.log("[DEBUG] Response headers:", xhr.getAllResponseHeaders());
                        resolve();
                    } else {
                        console.error("[DEBUG] R2 rejected upload:", {
                            status: xhr.status,
                            statusText: xhr.statusText,
                            response: xhr.responseText,
                            headers: xhr.getAllResponseHeaders(),
                        });
                        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                });

                xhr.addEventListener("error", () => {
                    console.error("[DEBUG] XHR network error");
                    reject(new Error("Network error"));
                });
                xhr.addEventListener("abort", () => {
                    console.error("[DEBUG] XHR upload aborted");
                    reject(new Error("Upload cancelled"));
                });

                xhr.open("PUT", uploadUrl);
                // Set Content-Type header - this is required for proper R2 handling
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
                console.log("[DEBUG] Uploading to R2 - fileId:", fileId);
                console.log("[DEBUG] Upload URL preview:", uploadUrl.substring(0, 100) + "...");
                console.log("[DEBUG] File details:", { name: file.name, size: file.size, type: file.type });
                xhr.send(file);
            });

            // Step 3: Finalize upload
            setUploadState((prev) => ({ ...prev, status: "finalizing", progress: 100 }));

            const finalizeRes = await fetch(`/api/v1/files/${fileId}/finalize`, {
                method: "POST",
            });

            if (!finalizeRes.ok) {
                const error = await finalizeRes.json();
                throw new Error(error.error || "Failed to finalize upload");
            }

            const { downloadUrl } = await finalizeRes.json();

            setUploadState({
                status: "success",
                progress: 100,
                fileId,
                downloadUrl,
            });
        } catch (error) {
            setUploadState({
                status: "error",
                progress: 0,
                error: error instanceof Error ? error.message : "Upload failed",
            });
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => setDragOver(false);

    const resetUpload = () => {
        setUploadState({ status: "idle", progress: 0 });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const copyLink = () => {
        if (uploadState.fileId) {
            navigator.clipboard.writeText(`${window.location.origin}/file/${uploadState.fileId}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <Link to="/" className="inline-block mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Lauralink
                        </h1>
                    </Link>
                    <p className="text-gray-400 text-lg">Share files securely, instantly.</p>
                </div>

                {/* Upload Area */}
                <div className="max-w-2xl mx-auto">
                    {uploadState.status === "idle" && (
                        <div
                            className={`
                relative border-2 border-dashed rounded-2xl p-12 text-center
                transition-all duration-300 cursor-pointer
                ${dragOver
                                    ? "border-purple-400 bg-purple-500/10"
                                    : "border-gray-600 hover:border-purple-500 bg-gray-800/50"
                                }
              `}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="text-6xl mb-4">📁</div>
                            <p className="text-gray-300 text-xl mb-2">
                                Drop a file here or click to browse
                            </p>
                            <p className="text-gray-500 text-sm">Max 5GB • Link expires in 30 days</p>
                        </div>
                    )}

                    {/* Progress State */}
                    {(uploadState.status === "preparing" ||
                        uploadState.status === "uploading" ||
                        uploadState.status === "finalizing") && (
                            <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur">
                                <div className="flex items-center justify-center mb-6">
                                    <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full" />
                                </div>
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                                        <span>
                                            {uploadState.status === "preparing" && "Preparing upload..."}
                                            {uploadState.status === "uploading" && "Uploading..."}
                                            {uploadState.status === "finalizing" && "Finalizing..."}
                                        </span>
                                        <span>{uploadState.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                            style={{ width: `${uploadState.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    {/* Success State */}
                    {uploadState.status === "success" && (
                        <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur text-center">
                            <div className="text-6xl mb-4">✅</div>
                            <h2 className="text-2xl font-bold text-white mb-4">Upload Complete!</h2>
                            <div className="bg-gray-900 rounded-lg p-4 mb-6">
                                <p className="text-gray-400 text-sm mb-2">Share this link:</p>
                                <p className="text-purple-400 font-mono text-sm break-all">
                                    {window.location.origin}/file/{uploadState.fileId}
                                </p>
                            </div>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={copyLink}
                                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors"
                                >
                                    Copy Link
                                </button>
                                <button
                                    onClick={resetUpload}
                                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-white transition-colors"
                                >
                                    Upload Another
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {uploadState.status === "error" && (
                        <div className="bg-red-900/30 border border-red-500 rounded-2xl p-8 text-center">
                            <div className="text-6xl mb-4">❌</div>
                            <h2 className="text-2xl font-bold text-white mb-2">Upload Failed</h2>
                            <p className="text-red-300 mb-6">{uploadState.error}</p>
                            <button
                                onClick={resetUpload}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-white transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
