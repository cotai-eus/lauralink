import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	Link,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Archivo+Black&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="font-sans">
				{children}
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
	let message = "FALHA";
	let details = "Algo saiu do trilho.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "ERRO";
		details =
			error.status === 404
				? "O link que voce tentou abrir nao existe."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="brutal-page">
			<div className="page-orb page-orb--yellow" />
			<div className="page-orb page-orb--purple" />
			<section className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6 md:p-10">
				<div className="brutal-card brutal-shadow max-w-3xl bg-white p-8 md:p-12">
					<p className="mb-4 text-sm font-bold uppercase tracking-[0.35em]">
						LAURALINK
					</p>
					<h1 className="font-display text-6xl leading-none tracking-[-0.08em] md:text-8xl">
						{message}
					</h1>
					<p className="mt-6 max-w-2xl text-lg font-medium md:text-2xl">
						{details}
					</p>
					<div className="mt-8">
						<Link className="brutal-button bg-[var(--color-yellow)]" to="/">
							VOLTAR PARA O INICIO
						</Link>
					</div>
					{stack && (
						<pre className="mt-8 overflow-x-auto brutal-card bg-[var(--color-cream)] p-4 text-sm">
							<code>{stack}</code>
						</pre>
					)}
				</div>
			</section>
		</main>
	);
}
