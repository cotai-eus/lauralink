import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/dashboard";

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

export default function DashboardPage() {
    const data = useLoaderData<typeof loader>();

    if (data.needsAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link to="/">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Lauralink
                            </h1>
                        </Link>
                        <p className="text-gray-400">Your uploaded files</p>
                    </div>
                    <Link
                        to="/upload"
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors"
                    >
                        Upload New
                    </Link>
                </div>

                {/* Files Grid */}
                {data.files.length === 0 ? (
                    <div className="text-center py-16 bg-gray-800/50 rounded-2xl">
                        <div className="text-6xl mb-4">📂</div>
                        <h2 className="text-xl font-semibold text-white mb-2">No files yet</h2>
                        <p className="text-gray-400">
                            <Link to="/upload" className="text-purple-400 hover:underline">
                                Upload your first file
                            </Link>
                        </p>
                    </div>
                ) : (
                    <div className="bg-gray-800/50 rounded-2xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-900/50">
                                <tr className="text-left text-gray-400 text-sm">
                                    <th className="px-6 py-4 font-medium">Name</th>
                                    <th className="px-6 py-4 font-medium">Size</th>
                                    <th className="px-6 py-4 font-medium">Downloads</th>
                                    <th className="px-6 py-4 font-medium">Expires</th>
                                    <th className="px-6 py-4 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {data.files.map((file: FileItem) => (
                                    <tr key={file.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">📄</span>
                                                <span className="text-white font-medium truncate max-w-[300px]">
                                                    {file.filename}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{formatBytes(file.sizeBytes)}</td>
                                        <td className="px-6 py-4 text-gray-300">{file.downloadsCount}</td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {file.expiresAt ? formatDate(file.expiresAt) : "Never"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/file/${file.id}`}
                                                className="text-purple-400 hover:text-purple-300 font-medium"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
