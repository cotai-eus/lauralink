import { useState } from "react";
import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/file.$id";
import { useToast } from "../components/Toast";
import { ShareButtons } from "../components/ShareButtons";
import { ExpirationCountdown } from "../components/ExpirationCountdown";
import { useTheme } from "../components/ThemeProvider";
import { ShareModal } from "../components/ShareModal";
import { QRCodeSVG } from "qrcode.react";

interface FileData {
    file: {
        id: string;
        filename: string;
        sizeBytes: number;
        mimeType: string;
        expiresAt: number | null;
        downloadsCount: number;
        createdAt: number;
    };
    downloadUrl: string;
}

export async function loader({ params, request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const res = await fetch(`${url.origin}/api/v1/files/${params.id}`);

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Response(error.error || "File not found", { status: res.status });
    }

    return res.json() as Promise<FileData>;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📕";
    if (mimeType.includes("zip") || mimeType.includes("rar")) return "📦";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
    return "📄";
}

function isPreviewable(mimeType: string): boolean {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export default function FilePage() {
    const data = useLoaderData<typeof loader>();
    const { file, downloadUrl } = data;
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();
    const [showQR, setShowQR] = useState(false);
    const [showShare, setShowShare] = useState(false);

    const copyLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copied to clipboard!", "success");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <div className="container mx-auto px-4 py-4 sm:py-6">
                <div className="flex justify-between items-center mb-4">
                    <Link
                        to="/"
                        className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent inline-block"
                    >
                        Lauralink
                    </Link>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-xl sm:text-2xl"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>

                {/* Breadcrumb */}
                <nav className="flex gap-2 text-xs sm:text-sm text-gray-400">
                    <Link to="/" className="hover:text-purple-400 transition-colors">Home</Link>
                    <span>/</span>
                    <span className="text-white truncate max-w-[180px] sm:max-w-xs">{file.filename}</span>
                </nav>
            </div>

            {/* File Card */}
            <div className="container mx-auto px-4 pb-16">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-gray-800/50 rounded-2xl p-6 sm:p-8 backdrop-blur border border-gray-700 animate-fadeIn hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300">
                        {/* File Icon & Name */}
                        <div className="text-center mb-8">
                            <div className="text-6xl sm:text-7xl mb-4">{getFileIcon(file.mimeType)}</div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white break-words mb-3">{file.filename}</h1>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                                <span>💾 {formatBytes(file.sizeBytes)}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>⬇️ {file.downloadsCount} downloads</span>
                            </div>
                        </div>

                        {/* Preview */}
                        {isPreviewable(file.mimeType) && (
                            <div className="mb-8 rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
                                {file.mimeType.startsWith("image/") ? (
                                    <img
                                        src={downloadUrl}
                                        alt={file.filename}
                                        className="max-h-64 sm:max-h-96 mx-auto w-full object-cover"
                                    />
                                ) : file.mimeType === "application/pdf" ? (
                                    <iframe
                                        src={downloadUrl}
                                        className="w-full h-64 sm:h-96"
                                        title={file.filename}
                                    />
                                ) : null}
                            </div>
                        )}

                        {/* File Info */}
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 mb-6 p-4 bg-gray-900/50 rounded-lg">
                            <div>
                                <p className="text-xs sm:text-sm text-gray-500">Created</p>
                                <p className="text-sm sm:text-base text-white">{formatDate(file.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-gray-500">Expires</p>
                                <ExpirationCountdown expiresAt={file.expiresAt} />
                            </div>
                        </div>

                        {/* Download Button */}
                        <a
                            href={downloadUrl}
                            download
                            className="block w-full mb-4 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-white text-center transition-all hover:scale-105 shadow-lg shadow-purple-500/25 text-base sm:text-lg active:scale-95"
                        >
                            ⬇️ Download File
                        </a>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
                            <button
                                onClick={copyLink}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-lg font-medium text-white transition-all text-sm sm:text-base touch-friendly"
                            >
                                📋 Copy
                            </button>
                            <button
                                onClick={() => setShowQR(!showQR)}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-lg font-medium text-white transition-all text-sm sm:text-base"
                            >
                                {showQR ? '🔗' : '📲'} QR
                            </button>
                            <button
                                onClick={() => setShowShare(true)}
                                className="px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-medium text-white transition-all text-sm sm:text-base col-span-2 sm:col-span-1"
                            >
                                📤 Share
                            </button>
                        </div>

                        {/* QR Code */}
                        {showQR && (
                            <div className="flex justify-center mb-6 p-4 sm:p-6 bg-white rounded-xl animate-fadeIn overflow-auto">
                                <QRCodeSVG
                                    value={window.location.href}
                                    size={Math.min(256, window.innerWidth - 80)}
                                    level="H"
                                    includeMargin
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Share Modal */}
                <ShareModal
                    url={window.location.href}
                    filename={file.filename}
                    isOpen={showShare}
                    onClose={() => setShowShare(false)}
                />

                {/* Footer */}
                <div className="text-center mt-8">
                    <Link
                        to="/upload"
                        className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        Upload your own file →
                    </Link>
                </div>
            </div>
        </div>
    );
}

export function ErrorBoundary({ error }: { error: Error }) {
    const message = error.message || "File not found";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <div className="text-center animate-fadeIn">
                <div className="text-7xl mb-4">😕</div>
                <h1 className="text-3xl font-bold text-white mb-4">File Not Available</h1>
                <p className="text-gray-400 mb-8">{message}</p>
                <Link
                    to="/"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors inline-block"
                >
                    Go Home
                </Link>
            </div>
        </div>
    );
}
