import { Link } from "react-router";
import type { Route } from "./+types/home";
import { useTheme } from "../components/ThemeProvider";

export function meta({ }: Route.MetaArgs) {
	return [
		{ title: "Lauralink - Secure File Sharing" },
		{ name: "description", content: "Share files securely with expiring links. No signup required." },
	];
}

export function loader({ context }: Route.LoaderArgs) {
	return { appName: context.cloudflare.env.VALUE_FROM_CLOUDFLARE || "Lauralink" };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { theme, toggleTheme } = useTheme();

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
			{/* Header with Theme Toggle */}
			<div className="container mx-auto px-4 py-4 sm:py-6 flex justify-end">
				<button
					onClick={toggleTheme}
					className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-xl sm:text-2xl"
					title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
				>
					{theme === 'dark' ? '☀️' : '🌙'}
				</button>
			</div>

			<div className="container mx-auto px-4 py-6 sm:py-8">
				{/* Hero */}
				<div className="text-center mb-12 sm:mb-16 animate-fadeIn">
					<h1 className="text-4xl sm:text-6xl font-bold mb-4 sm:mb-6">
						<span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
							{loaderData.appName}
						</span>
					</h1>
					<p className="text-base sm:text-xl text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
						Share files securely with expiring links. Fast, private, and serverless.
						<br />
						<span className="text-xs sm:text-sm text-gray-500">Powered by Cloudflare Edge.</span>
					</p>
					<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
						<Link
							to="/upload"
							className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 active:from-purple-800 active:to-pink-800 rounded-xl font-semibold text-white text-base sm:text-lg transition-all shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95"
						>
							📤 Upload File
						</Link>
						<Link
							to="/dashboard"
							className="px-6 sm:px-8 py-3 sm:py-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl font-semibold text-white text-base sm:text-lg transition-colors border border-gray-700 hover:border-purple-500 hover:scale-105 active:scale-95"
						>
							📁 My Files
						</Link>
					</div>
				</div>

				{/* Features */}
				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
					<div className="bg-gray-800/50 rounded-2xl p-6 sm:p-8 backdrop-blur text-center border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 animate-fadeIn">
						<div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🚀</div>
						<h3 className="text-lg sm:text-xl font-bold text-white mb-2">Lightning Fast</h3>
						<p className="text-sm sm:text-base text-gray-400">
							Direct upload to edge storage. No server bottlenecks.
						</p>
					</div>
					<div className="bg-gray-800/50 rounded-2xl p-6 sm:p-8 backdrop-blur text-center border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 animate-fadeIn">
						<div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔒</div>
						<h3 className="text-lg sm:text-xl font-bold text-white mb-2">Secure Links</h3>
						<p className="text-sm sm:text-base text-gray-400">
							Time-limited URLs. Your files expire automatically.
						</p>
					</div>
					<div className="bg-gray-800/50 rounded-2xl p-6 sm:p-8 backdrop-blur text-center border border-gray-700 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 animate-fadeIn sm:col-span-2 lg:col-span-1">
						<div className="text-4xl sm:text-5xl mb-3 sm:mb-4">☁️</div>
						<h3 className="text-lg sm:text-xl font-bold text-white mb-2">Serverless</h3>
						<p className="text-sm sm:text-base text-gray-400">
							100% edge computing. No cold starts, no limits.
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className="text-center mt-12 sm:mt-16 text-gray-500">
					<p className="text-xs sm:text-sm">Up to 20MB per file • Links expire in 30 days (free tier)</p>
				</div>
			</div>
		</div>
	);
}
