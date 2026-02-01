import { useState } from "react";
import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { StatsCard } from "../components/StatsCard";
import { ExpirationCountdown } from "../components/ExpirationCountdown";
import { useToast } from "../components/Toast";
import { useTheme } from "../components/ThemeProvider";

interface FileItem {
    id: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    status: string;
    expiresAt: number | null;
    downloadsCount: number;
    createdAt: number;
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    // In a real app, get user ID from session
    // For now, we'll show a placeholder
    const userId = request.headers.get("X-User-Id");

    if (!userId) {
        return { files: [], total: 0, page: 1, pageSize: 20, needsAuth: true };
    }

    const res = await fetch(`${url.origin}/api/v1/files?page=${page}`, {
        headers: { "X-User-Id": userId },
    });

    if (!res.ok) {
        return { files: [], total: 0, page: 1, pageSize: 20, error: "Failed to load files" };
    }

    return res.json();
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
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📕";
    if (mimeType.includes("zip")) return "📦";
    return "📄";
}

export default function DashboardPage() {
    const data = useLoaderData<typeof loader>();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    if (data.needsAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center animate-fadeIn">
                    <h1 className="text-3xl font-bold text-white mb-4">Dashboard Coming Soon</h1>
                    <p className="text-gray-400 mb-8">
                        Authentication is required to view your files. This feature will be enabled soon.
                    </p>
                    <Link
                        to="/upload"
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors inline-block"
                    >
                        Go to Upload
                    </Link>
                </div>
            </div>
        );
    }

    const filteredFiles = data.files.filter((f: FileItem) =>
        f.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalSize = data.files.reduce((sum: number, f: FileItem) => sum + f.sizeBytes, 0);
    const totalDownloads = data.files.reduce((sum: number, f: FileItem) => sum + f.downloadsCount, 0);

    const toggleFileSelection = (fileId: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(fileId)) {
            newSelected.delete(fileId);
        } else {
            newSelected.add(fileId);
        }
        setSelectedFiles(newSelected);
    };

    const downloadSelected = async () => {
        if (selectedFiles.size === 0) {
            showToast("No files selected", "error");
            return;
        }

        setIsDownloading(true);
        try {
            // Dynamic import JSZip only when needed
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();

            for (const fileId of selectedFiles) {
                const res = await fetch(`/api/v1/files/${fileId}`);
                const fileData = await res.json();
                const fileRes = await fetch(fileData.downloadUrl);
                const blob = await fileRes.blob();
                zip.file(fileData.file.filename, blob);
            }

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipBlob);
            link.download = "lauralink-files.zip";
            link.click();

            showToast(`Downloaded ${selectedFiles.size} files`, "success");
            setSelectedFiles(new Set());
        } catch (error) {
            showToast("Failed to download files", "error");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-6 sm:py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4 sm:gap-0">
                    <div>
                        <Link to="/">
                            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Lauralink
                            </h1>
                        </Link>
                        <p className="text-xs sm:text-sm text-gray-400">Your uploaded files</p>
                    </div>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-xl sm:text-2xl"
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        <Link
                            to="/upload"
                            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors text-sm sm:text-base text-center"
                        >
                            📤 Upload
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 animate-fadeIn">
                    <StatsCard icon="📁" label="Total Files" value={data.total} />
                    <StatsCard icon="💾" label="Storage Used" value={formatBytes(totalSize)} />
                    <StatsCard icon="⬇️" label="Total Downloads" value={totalDownloads} />
                </div>

                {/* Search & Actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 animate-fadeIn">
                    <input
                        type="search"
                        placeholder="🔍 Search files..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg bg-gray-800/50 text-white placeholder-gray-400 text-sm sm:text-base border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
                    />
                    {selectedFiles.size > 0 && (
                        <button
                            onClick={downloadSelected}
                            disabled={isDownloading}
                            className="px-3 sm:px-6 py-2 sm:py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-600 rounded-lg font-medium text-white transition-colors text-sm sm:text-base whitespace-nowrap"
                        >
                            {isDownloading ? "⏳ Downloading..." : `📦 ${selectedFiles.size}`}
                        </button>
                    )}
                </div>

                {/* Files Grid */}
                {data.files.length === 0 ? (
                    <div className="text-center py-12 sm:py-16 bg-gray-800/50 rounded-2xl animate-fadeIn">
                        <div className="text-5xl sm:text-6xl mb-4">📂</div>
                        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">No files yet</h2>
                        <p className="text-sm sm:text-base text-gray-400">
                            <Link to="/upload" className="text-purple-400 hover:underline">
                                Upload your first file
                            </Link>
                        </p>
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-12 sm:py-16 bg-gray-800/50 rounded-2xl animate-fadeIn">
                        <div className="text-5xl sm:text-6xl mb-4">🔍</div>
                        <p className="text-base sm:text-xl text-gray-400">No files match your search</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {filteredFiles.map((file: FileItem) => (
                            <div
                                key={file.id}
                                className="group bg-gray-800/50 rounded-xl p-4 sm:p-6 backdrop-blur border border-gray-700 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 animate-fadeIn"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="text-3xl sm:text-4xl">{getFileIcon(file.mimeType)}</div>
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.has(file.id)}
                                        onChange={() => toggleFileSelection(file.id)}
                                        className="w-5 h-5 cursor-pointer accent-purple-500"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>

                                <Link to={`/file/${file.id}`} className="block">
                                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2 truncate group-hover:text-purple-400 transition-colors">
                                        {file.filename}
                                    </h3>

                                    <div className="space-y-1 text-xs sm:text-sm text-gray-400">
                                        <p>💾 {formatBytes(file.sizeBytes)}</p>
                                        <p>📅 {formatDate(file.createdAt)}</p>
                                        <p>⬇️ {file.downloadsCount} downloads</p>
                                        <ExpirationCountdown expiresAt={file.expiresAt} />
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
