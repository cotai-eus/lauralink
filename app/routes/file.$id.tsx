import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/file.$id";

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

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        to="/"
                        className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent inline-block mb-4"
                    >
                        Lauralink
                    </Link>
                </div>

                {/* File Card */}
                <div className="max-w-2xl mx-auto">
                    <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur">
                        {/* File Icon & Name */}
                        <div className="text-center mb-8">
                            <div className="text-7xl mb-4">{getFileIcon(file.mimeType)}</div>
                            <h1 className="text-2xl font-bold text-white break-words">{file.filename}</h1>
                        </div>

                        {/* Preview (if applicable) */}
                        {isPreviewable(file.mimeType) && (
                            <div className="mb-8 rounded-lg overflow-hidden bg-gray-900">
                                {file.mimeType.startsWith("image/") ? (
                                    <img
                                        src={downloadUrl}
                                        alt={file.filename}
                                        className="max-h-96 mx-auto"
                                    />
                                ) : (
                                    <iframe
                                        src={downloadUrl}
                                        className="w-full h-96"
                                        title={file.filename}
                                    />
                                )}
                            </div>
                        )}

                        {/* File Details */}
                        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                            <div className="bg-gray-900/50 rounded-lg p-4">
                                <p className="text-gray-500 mb-1">Size</p>
                                <p className="text-white font-medium">{formatBytes(file.sizeBytes)}</p>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-4">
                                <p className="text-gray-500 mb-1">Downloads</p>
                                <p className="text-white font-medium">{file.downloadsCount}</p>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-4">
                                <p className="text-gray-500 mb-1">Uploaded</p>
                                <p className="text-white font-medium">{formatDate(file.createdAt)}</p>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-4">
                                <p className="text-gray-500 mb-1">Expires</p>
                                <p className="text-white font-medium">
                                    {file.expiresAt ? formatDate(file.expiresAt) : "Never"}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a
                                href={downloadUrl}
                                download={file.filename}
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-medium text-white text-center transition-all"
                            >
                                Download File
                            </a>
                            <button
                                onClick={copyLink}
                                className="flex-1 px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-white transition-colors"
                            >
                                Copy Link
                            </button>
                        </div>
                    </div>

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
        </div>
    );
}

export function ErrorBoundary({ error }: { error: Error }) {
    const message = error.message || "File not found";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
            <div className="text-center">
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
