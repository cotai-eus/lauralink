import { useState, useRef, useCallback } from "react";
import { Link } from "react-router";
import { useToast } from "../components/Toast";
import { useTheme } from "../components/ThemeProvider";
import { QRCodeSVG } from "qrcode.react";

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
    const [showQR, setShowQR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

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
            setUploadState((prev) => ({ ...prev, status: "uploading" }));

            // Step 2: Upload directly to R2
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        setUploadState((prev) => ({ ...prev, progress }));
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}`));
                    }
                });

                xhr.addEventListener("error", () => reject(new Error("Network error")));
                xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
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

            const downloadUrl = `${window.location.origin}/file/${fileId}`;
            setUploadState({ status: "success", progress: 100, fileId, downloadUrl });
            showToast("File uploaded successfully! 🎉", "success");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            setUploadState({ status: "error", progress: 0, error: message });
            showToast(message, "error");
        }
    }, [showToast]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => {
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files[0]) handleUpload(files[0]);
    };

    const copyToClipboard = async () => {
        if (uploadState.downloadUrl) {
            await navigator.clipboard.writeText(uploadState.downloadUrl);
            showToast("Link copied to clipboard!", "success");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 transition-colors duration-300">
            {/* Header with Theme Toggle */}
            <div className="container mx-auto px-4 py-6 flex justify-between items-center">
                <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Lauralink
                </Link>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    <span className="text-2xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
                </button>
            </div>

            <div className="container mx-auto px-4 py-16 max-w-2xl">
                {uploadState.status === "idle" && (
                    <div className="animate-fadeIn">
                        <h1 className="text-4xl font-bold text-white mb-8 text-center">
                            Upload Your File
                        </h1>

                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
                                transition-all duration-300 backdrop-blur
                                ${dragOver 
                                    ? 'border-purple-500 bg-purple-500/20 scale-105 shadow-2xl shadow-purple-500/50' 
                                    : 'border-gray-600 hover:border-purple-400 bg-gray-800/30 hover:bg-gray-800/50'
                                }
                            `}
                        >
                            <div className="text-7xl mb-6">{dragOver ? '📥' : '📤'}</div>
                            <p className="text-2xl text-white mb-2 font-semibold">
                                {dragOver ? 'Drop it here!' : 'Drag & Drop'}
                            </p>
                            <p className="text-gray-400 mb-4">or click to browse</p>
                            <p className="text-sm text-gray-500">Max file size: 20MB</p>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                        />
                    </div>
                )}

                {(uploadState.status === "preparing" || uploadState.status === "uploading" || uploadState.status === "finalizing") && (
                    <div className="animate-fadeIn bg-gray-800/50 rounded-2xl p-8 backdrop-blur">
                        <h2 className="text-2xl font-bold text-white mb-6 text-center">
                            {uploadState.status === "preparing" && "Preparing upload..."}
                            {uploadState.status === "uploading" && `Uploading... ${uploadState.progress}%`}
                            {uploadState.status === "finalizing" && "Finalizing..."}
                        </h2>

                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden mb-4">
                            <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                                style={{ width: `${uploadState.progress}%` }}
                            />
                        </div>

                        <div className="flex items-center justify-center gap-2 text-gray-400">
                            <div className="animate-spin">⚡</div>
                            <span>Please don't close this page</span>
                        </div>
                    </div>
                )}

                {uploadState.status === "success" && uploadState.downloadUrl && (
                    <div className="animate-fadeIn bg-gray-800/50 rounded-2xl p-6 sm:p-8 backdrop-blur border border-green-500/30">
                        <div className="text-center mb-6">
                            <div className="text-5xl sm:text-6xl mb-4">✅</div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Upload Successful!</h2>
                            <p className="text-sm sm:text-base text-gray-400">Your file is ready to share</p>
                        </div>

                        <div className="bg-gray-900/50 rounded-lg p-4 mb-6 break-all">
                            <p className="text-purple-400 font-mono text-xs sm:text-sm">{uploadState.downloadUrl}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
                            <button
                                onClick={copyToClipboard}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-lg font-medium text-white transition-all text-sm sm:text-base"
                            >
                                📋 Copy
                            </button>
                            <button
                                onClick={() => setShowQR(!showQR)}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-lg font-medium text-white transition-all text-sm sm:text-base"
                            >
                                {showQR ? '🔗' : '📲'} QR
                            </button>
                        </div>

                        {showQR && (
                            <div className="flex justify-center mb-6 p-4 sm:p-6 bg-white rounded-xl animate-fadeIn overflow-auto">
                                <QRCodeSVG
                                    value={uploadState.downloadUrl}
                                    size={Math.min(256, window.innerWidth - 80)}
                                    level="H"
                                    includeMargin
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <Link
                                to={`/file/${uploadState.fileId}`}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-white text-center transition-colors text-sm sm:text-base"
                            >
                                View File
                            </Link>
                            <button
                                onClick={() => setUploadState({ status: "idle", progress: 0 })}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-white transition-colors text-sm sm:text-base"
                            >
                                Upload More
                            </button>
                        </div>
                    </div>
                )}

                {uploadState.status === "error" && (
                    <div className="animate-fadeIn bg-gray-800/50 rounded-2xl p-6 sm:p-8 backdrop-blur border border-red-500/30">
                        <div className="text-center">
                            <div className="text-5xl sm:text-6xl mb-4">❌</div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Upload Failed</h2>
                            <p className="text-sm sm:text-base text-red-400 mb-6">{uploadState.error}</p>
                            <button
                                onClick={() => setUploadState({ status: "idle", progress: 0 })}
                                className="px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors text-sm sm:text-base"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
