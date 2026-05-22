import { Form, Link, data, redirect } from "react-router";

import {
	callInternalApi,
	forwardInternalCookies,
	toCloudflareContext,
} from "../.server/lauralink-api";
import { ShareQr } from "../components/share-qr";
import { formatBytes, type ShareMetadata } from "../lib/files";
import type { Route } from "./+types/download";

type ActionData = {
	unlockError?: string;
};

export function meta({ loaderData }: Route.MetaArgs) {
	if (!loaderData) {
		return [{ title: "Lauralink | Share" }];
	}

	const title =
		loaderData.fileCount === 1
			? loaderData.files[0]?.fileName ?? "Arquivo"
			: `${loaderData.fileCount} arquivos`;

	return [
		{ title: `${title} | Lauralink` },
		{
			name: "description",
			content: "Baixe um lote compartilhado pelo Lauralink com QR e senha opcional.",
		},
	];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
	if (!params.id) {
		throw new Response("Share nao encontrado.", {
			status: 404,
			statusText: "Share nao encontrado.",
		});
	}

	const headers = new Headers(request.headers);
	headers.set("Accept", "application/json");

	const response = await callInternalApi(
		new Request(new URL(`/api/shares/${params.id}`, request.url), {
			method: "GET",
			headers,
		}),
		toCloudflareContext(context.cloudflare),
	);

	if (!response.ok) {
		throw new Response(await extractApiError(response), {
			status: response.status,
			statusText:
				response.status === 404
					? "Share nao encontrado."
					: "Falha ao carregar o share.",
		});
	}

	return (await response.json()) as ShareMetadata;
}

export async function action({
	request,
	params,
	context,
}: Route.ActionArgs): Promise<Response | ReturnType<typeof data<ActionData>>> {
	if (!params.id) {
		throw new Response("Share nao encontrado.", {
			status: 404,
			statusText: "Share nao encontrado.",
		});
	}

	const formData = await request.formData();

	const response = await callInternalApi(
		new Request(new URL(`/api/shares/${params.id}/unlock`, request.url), {
			method: "POST",
			headers: request.headers,
			body: formData,
		}),
		toCloudflareContext(context.cloudflare),
	);

	if (!response.ok) {
		return data<ActionData>(
			{ unlockError: await extractApiError(response) },
			{ status: response.status },
		);
	}

	return redirect(request.url, {
		headers: forwardInternalCookies(response),
	});
}

export default function Download({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const isLocked =
		loaderData.isPasswordProtected && !loaderData.isUnlocked;
	const headline =
		loaderData.fileCount === 1
			? loaderData.files[0]?.fileName ?? "Arquivo"
			: `${loaderData.fileCount} ARQUIVOS PRONTOS`;

	return (
		<main className="brutal-page">
			<div className="page-orb page-orb--yellow" />
			<div className="page-orb page-orb--purple" />
			<section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center p-6 md:p-10">
				<div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px]">
					<div className="flex flex-col gap-6">
						<section className="brutal-card brutal-shadow bg-white p-8 md:p-12">
							<p className="text-sm font-bold uppercase tracking-[0.35em]">
								LINK DE SHARE
							</p>
							<h1 className="font-display mt-5 text-5xl leading-[0.92] tracking-[-0.08em] md:text-8xl">
								{headline}
							</h1>
							<div className="mt-8 flex flex-wrap gap-3">
								<span className="brutal-pill bg-[var(--color-yellow)]">
									{loaderData.fileCount} arquivo(s)
								</span>
								<span className="brutal-pill bg-white">
									{formatBytes(loaderData.totalSizeBytes)}
								</span>
								<span className="brutal-pill bg-white">
									{formatDate(loaderData.createdAt)}
								</span>
								{loaderData.isPasswordProtected ? (
									<span className="brutal-pill bg-[var(--color-purple)] text-white">
										SENHA ATIVA
									</span>
								) : null}
							</div>
							<p className="mt-8 max-w-3xl text-lg font-medium md:text-2xl">
								A vitrine do lote fica aberta, mas os downloads podem exigir um
								desbloqueio unico por navegador quando a senha estiver ativa.
							</p>
							<div className="mt-10 flex flex-wrap gap-4">
								<Link className="brutal-button bg-white" to="/">
									ENVIAR OUTRO
								</Link>
							</div>
						</section>

						{isLocked ? (
							<section className="brutal-card brutal-shadow bg-[var(--color-yellow)] p-6">
								<p className="text-sm font-bold uppercase tracking-[0.25em]">
									Desbloquear downloads
								</p>
								<p className="mt-3 text-lg font-medium">
									Informe a senha deste share uma vez para liberar os botoes de
									download neste navegador.
								</p>
								{actionData?.unlockError ? (
									<div className="mt-5 brutal-card bg-[var(--color-purple)] p-4 text-white">
										<p className="text-sm font-bold uppercase tracking-[0.18em]">
											Senha rejeitada
										</p>
										<p className="mt-2 text-base font-medium">
											{actionData.unlockError}
										</p>
									</div>
								) : null}
								<Form method="post" className="mt-5 flex flex-col gap-4 md:flex-row">
									<input
										className="brutal-input min-w-0 flex-1"
										type="password"
										name="password"
										placeholder="Digite a senha do share"
									/>
									<button
										type="submit"
										className="brutal-button bg-white"
									>
										DESBLOQUEAR
									</button>
								</Form>
							</section>
						) : null}

						<section className="brutal-card brutal-shadow bg-white p-6">
							<p className="text-sm font-bold uppercase tracking-[0.25em]">
								Arquivos do lote
							</p>
							<div className="mt-5 flex flex-col gap-4">
								{loaderData.files.map((file, index) => (
									<div
										key={file.id}
										className="brutal-card bg-[var(--color-cream)] p-4 md:p-5"
									>
										<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
											<div className="min-w-0">
												<p className="text-sm font-bold uppercase tracking-[0.18em]">
													Arquivo {index + 1}
												</p>
												<p className="mt-2 break-all text-xl font-black tracking-[-0.04em]">
													{file.fileName}
												</p>
												<p className="mt-2 text-sm font-medium uppercase tracking-[0.12em]">
													{formatBytes(file.sizeBytes)} · {file.contentType}
												</p>
											</div>
											{isLocked ? (
												<button
													type="button"
													disabled
													className="brutal-button cursor-not-allowed bg-white opacity-60"
												>
													BLOQUEADO
												</button>
											) : (
												<a
													className="brutal-button bg-[var(--color-purple)] text-white"
													href={file.downloadUrl}
												>
													BAIXAR
												</a>
											)}
										</div>
									</div>
								))}
							</div>
						</section>
					</div>

					<aside className="flex flex-col gap-6">
						<section className="brutal-card brutal-shadow bg-[var(--color-yellow)] p-6">
							<p className="text-sm font-bold uppercase tracking-[0.25em]">
								ID do share
							</p>
							<p className="mt-3 break-all text-3xl font-black tracking-[-0.05em]">
								{loaderData.id}
							</p>
						</section>

						<section className="brutal-card brutal-shadow bg-white p-6">
							<p className="text-sm font-bold uppercase tracking-[0.25em]">
								QR code
							</p>
							<ShareQr
								className="mt-4 mx-auto max-w-[220px]"
								shareUrl={loaderData.shareUrl}
							/>
						</section>

						<section className="brutal-card brutal-shadow bg-white p-6">
							<p className="text-sm font-bold uppercase tracking-[0.25em]">
								URL publica
							</p>
							<p className="mt-3 break-all text-lg font-medium">
								{loaderData.shareUrl}
							</p>
						</section>
					</aside>
				</div>
			</section>
		</main>
	);
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("pt-BR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

async function extractApiError(response: Response): Promise<string> {
	try {
		const payload = (await response.json()) as { error?: string };
		if (payload.error) {
			return payload.error;
		}
	} catch {
		// Ignore JSON parsing failures and use a fallback below.
	}

	return "Nao foi possivel concluir esta operacao.";
}
