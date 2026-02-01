import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/Toast";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				<ThemeProvider>
					<ToastProvider>
						{children}
					</ToastProvider>
				</ThemeProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
			<div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur max-w-lg w-full">
				<h1 className="text-4xl font-bold text-white mb-4">{message}</h1>
				<p className="text-gray-300 mb-6">{details}</p>
				{stack && (
					<pre className="text-xs bg-gray-900 p-4 rounded overflow-auto text-gray-400">
						{stack}
					</pre>
				)}
				<a
					href="/"
					className="inline-block mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors"
				>
					Go Home
				</a>
			</div>
		</main>
	);
}
