import { Link } from "react-router";
import type { Route } from "./+types/home";

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
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
			<div className="container mx-auto px-4 py-16">
				{/* Hero */}
				<div className="text-center mb-16">
					<h1 className="text-6xl font-bold mb-6">
						<span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
							{loaderData.appName}
						</span>
					</h1>
					<p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
						Share files securely with expiring links. Fast, private, and serverless.
						<br />
						<span className="text-gray-500">Powered by Cloudflare Edge.</span>
					</p>
					<div className="flex gap-4 justify-center">
						<Link
							to="/upload"
							className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-white text-lg transition-all shadow-lg shadow-purple-500/25"
						>
							Upload File
						</Link>
						<Link
							to="/dashboard"
							className="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-white text-lg transition-colors border border-gray-700"
						>
							My Files
						</Link>
					</div>
				</div>

				{/* Features */}
				<div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
					<div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur text-center">
						<div className="text-5xl mb-4">🚀</div>
						<h3 className="text-xl font-bold text-white mb-2">Lightning Fast</h3>
						<p className="text-gray-400">
							Direct upload to edge storage. No server bottlenecks.
						</p>
					</div>
					<div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur text-center">
						<div className="text-5xl mb-4">🔒</div>
						<h3 className="text-xl font-bold text-white mb-2">Secure Links</h3>
						<p className="text-gray-400">
							Time-limited URLs. Your files expire automatically.
						</p>
					</div>
					<div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur text-center">
						<div className="text-5xl mb-4">☁️</div>
						<h3 className="text-xl font-bold text-white mb-2">Serverless</h3>
						<p className="text-gray-400">
							100% edge computing. No cold starts, no limits.
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className="text-center mt-16 text-gray-500">
					<p>Up to 5GB per file • Links expire in 30 days (free tier)</p>
				</div>
			</div>
		</div>
	);
}
