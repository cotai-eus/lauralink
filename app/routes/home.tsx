import { useRef, useState } from "react";
import { Form, data, useNavigation } from "react-router";

import {
	callInternalApi,
	forwardInternalCookies,
	toCloudflareContext,
} from "../.server/lauralink-api";
import { ShareQr } from "../components/share-qr";
import {
	formatBytes,
	MAX_FILES_PER_SHARE,
	MAX_TOTAL_UPLOAD_LABEL,
	type UploadResponse,
} from "../lib/files";
import type { Route } from "./+types/home";

type ActionData = {
	error?: string;
	upload?: UploadResponse;
};

type SelectedFile = {
	name: string;
	sizeBytes: number;
};

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Lauralink | Multi-share brutalista" },
		{
			name: "description",
			content:
				"Suba ate 10 arquivos, gere um unico link, proteja com senha e compartilhe por QR code.",
		},
	];
}

export async function action({
	request,
	context,
}: Route.ActionArgs): Promise<ReturnType<typeof data<ActionData>>> {
	const formData = await request.formData();
	const password =
		typeof formData.get("password") === "string"
			? (formData.get("password") as string)
			: "";
	const passwordConfirm =
		typeof formData.get("passwordConfirm") === "string"
			? (formData.get("passwordConfirm") as string)
			: "";

	if (password !== passwordConfirm) {
		return data<ActionData>(
			{ error: "A confirmacao da senha nao confere." },
			{ status: 400 },
		);
	}

	formData.delete("passwordConfirm");

	const forwardedHeaders = new Headers(request.headers);
	forwardedHeaders.delete("content-type");
	forwardedHeaders.delete("content-length");

	const apiRequest = new Request(new URL("/api/upload", request.url), {
		method: "POST",
		headers: forwardedHeaders,
		body: formData,
	});
	const response = await callInternalApi(
		apiRequest,
		toCloudflareContext(context.cloudflare),
	);

	if (!response.ok) {
		return data<ActionData>(
			{ error: await extractApiError(response) },
			{
				status: response.status,
				headers: forwardInternalCookies(response),
			},
		);
	}

	return data<ActionData>(
		{ upload: (await response.json()) as UploadResponse },
		{
			status: response.status,
			headers: forwardInternalCookies(response),
		},
	);
}

export default function Home({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const inputRef = useRef<HTMLInputElement>(null);
	const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const isSubmitting =
		navigation.state === "submitting" || navigation.state === "loading";
	const selectedTotalBytes = selectedFiles.reduce(
		(total, file) => total + file.sizeBytes,
		0,
	);

	function syncFiles(files: FileList | null) {
		if (!files?.length || !inputRef.current) {
			return;
		}

		const transfer = new DataTransfer();
		Array.from(files).forEach((file) => transfer.items.add(file));
		inputRef.current.files = transfer.files;
		setSelectedFiles(
			Array.from(transfer.files).map((file) => ({
				name: file.name,
				sizeBytes: file.size,
			})),
		);
	}

	return (
		<main className="brutal-page">
			<div className="page-orb page-orb--yellow" />
			<div className="page-orb page-orb--purple" />
			<section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 p-6 md:p-10">
				<header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div>
						<p className="text-sm font-bold uppercase tracking-[0.35em]">
							LAURALINK
						</p>
						<h1 className="font-display max-w-5xl text-6xl leading-[0.9] tracking-[-0.08em] md:text-8xl">
							Ate 10 arquivos. Um link. QR code. Senha opcional.
						</h1>
					</div>
					<div className="brutal-card brutal-shadow max-w-sm bg-[var(--color-yellow)] p-5">
						<p className="text-sm font-bold uppercase tracking-[0.18em]">
							V2 multi-share
						</p>
						<p className="mt-3 text-lg font-medium">
							Monte um lote brutalista de arquivos e entregue por uma unica URL
							publica.
						</p>
					</div>
				</header>

				<div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
					<Form
						method="post"
						encType="multipart/form-data"
						className="brutal-card brutal-shadow bg-white p-4 md:p-6"
					>
						<input
							ref={inputRef}
							className="hidden"
							type="file"
							name="files"
							multiple
							onChange={(event) => syncFiles(event.currentTarget.files)}
						/>

						<div
							role="button"
							tabIndex={0}
							className={`flex min-h-[22rem] w-full flex-col justify-between gap-8 p-6 text-left md:p-10 ${
								isDragging ? "bg-[var(--color-yellow)]" : "bg-white"
							} brutal-dash`}
							onClick={(event) => {
								if (
									(event.target as HTMLElement).closest(
										"[data-stop-dropzone-click]",
									)
								) {
									return;
								}
								inputRef.current?.click();
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									inputRef.current?.click();
								}
							}}
							onDragEnter={(event) => {
								event.preventDefault();
								setIsDragging(true);
							}}
							onDragOver={(event) => {
								event.preventDefault();
								setIsDragging(true);
							}}
							onDragLeave={(event) => {
								event.preventDefault();
								setIsDragging(false);
							}}
							onDrop={(event) => {
								event.preventDefault();
								setIsDragging(false);
								syncFiles(event.dataTransfer.files);
							}}
						>
							<div className="space-y-6">
								<p className="text-sm font-bold uppercase tracking-[0.25em]">
									Arraste aqui ou clique para montar seu lote
								</p>
								<h2 className="font-display text-5xl leading-none tracking-[-0.08em] md:text-7xl">
									{isSubmitting ? "ENVIANDO..." : "DROP. STACK. SHARE."}
								</h2>
								<p className="max-w-3xl text-lg font-medium md:text-2xl">
									Ate {MAX_FILES_PER_SHARE} arquivos por upload, somando no
									maximo {MAX_TOTAL_UPLOAD_LABEL}. O link nasce com QR e pode
									sair protegido por senha.
								</p>
							</div>

							<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
								<div>
									<p className="text-sm font-bold uppercase tracking-[0.22em]">
										Lote selecionado
									</p>
									<p className="mt-2 text-xl font-bold md:text-3xl">
										{selectedFiles.length > 0
											? `${selectedFiles.length} arquivo(s) · ${formatBytes(selectedTotalBytes)}`
											: "Nenhum arquivo selecionado ainda"}
									</p>
								</div>
								<button
									type="submit"
									data-stop-dropzone-click
									disabled={isSubmitting}
									className="brutal-button bg-[var(--color-purple)] text-white disabled:cursor-not-allowed disabled:opacity-70"
								>
									{isSubmitting ? "ENVIANDO..." : "GERAR SHARE"}
								</button>
							</div>
						</div>

						<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
							<section className="brutal-card bg-[var(--color-cream)] p-5">
								<p className="text-sm font-bold uppercase tracking-[0.2em]">
									Arquivos no lote
								</p>
								{selectedFiles.length > 0 ? (
									<ul className="mt-4 flex flex-col gap-3">
										{selectedFiles.map((file) => (
											<li
												key={`${file.name}-${file.sizeBytes}`}
												className="brutal-card bg-white p-3"
											>
												<p className="break-all text-base font-bold">
													{file.name}
												</p>
												<p className="mt-1 text-sm font-medium">
													{formatBytes(file.sizeBytes)}
												</p>
											</li>
										))}
									</ul>
								) : (
									<p className="mt-4 text-lg font-medium">
										A lista aparece aqui assim que voce escolher os arquivos.
									</p>
								)}
							</section>

							<section className="brutal-card bg-white p-5">
								<p className="text-sm font-bold uppercase tracking-[0.2em]">
									Protecao opcional
								</p>
								<div className="mt-4 grid gap-4">
									<label className="grid gap-2">
										<span className="text-sm font-bold uppercase tracking-[0.18em]">
											Senha
										</span>
										<input
											className="brutal-input"
											type="password"
											name="password"
											placeholder="Deixe em branco para link aberto"
										/>
									</label>
									<label className="grid gap-2">
										<span className="text-sm font-bold uppercase tracking-[0.18em]">
											Confirmar senha
										</span>
										<input
											className="brutal-input"
											type="password"
											name="passwordConfirm"
											placeholder="Repita a senha para evitar erro"
										/>
									</label>
								</div>
							</section>
						</div>
					</Form>

					<aside className="flex flex-col gap-6">
						<section className="brutal-card brutal-shadow bg-[var(--color-yellow)] p-6">
							<p className="text-sm font-bold uppercase tracking-[0.25em]">
								Regras do jogo
							</p>
							<ul className="mt-5 flex flex-col gap-4 text-lg font-medium">
								<li>Ate 10 arquivos por lote.</li>
								<li>Limite total de {MAX_TOTAL_UPLOAD_LABEL}.</li>
								<li>QR code gerado junto com o link.</li>
								<li>Senha protege os downloads, nao a vitrine do share.</li>
							</ul>
						</section>

						<section className="brutal-card brutal-shadow bg-white p-6">
							<p className="text-sm font-bold uppercase tracking-[0.25em]">
								Status
							</p>
							{actionData?.error ? (
								<div className="mt-5 brutal-card bg-[var(--color-purple)] p-5 text-white">
									<p className="text-sm font-bold uppercase tracking-[0.2em]">
										Falhou
									</p>
									<p className="mt-2 text-lg font-medium">{actionData.error}</p>
								</div>
							) : null}

							{actionData?.upload ? (
								<div className="mt-5 space-y-5">
									<div className="brutal-card bg-[var(--color-cream)] p-5">
										<p className="text-sm font-bold uppercase tracking-[0.2em]">
											Link pronto
										</p>
										<p className="mt-2 break-all text-lg font-bold">
											{actionData.upload.share.shareUrl}
										</p>
										<p className="mt-3 text-sm font-medium uppercase tracking-[0.15em]">
											{actionData.upload.share.fileCount} arquivo(s) ·{" "}
											{formatBytes(actionData.upload.share.totalSizeBytes)}
										</p>
									</div>

									<div className="brutal-card bg-white p-4">
										<ShareQr
											className="mx-auto max-w-[220px]"
											shareUrl={actionData.upload.share.shareUrl}
										/>
									</div>

									<div className="flex flex-wrap gap-3">
										<a
											className="brutal-button bg-[var(--color-yellow)]"
											href={actionData.upload.share.shareUrl}
										>
											ABRIR SHARE
										</a>
										{actionData.upload.share.files.length === 1 ? (
											<a
												className="brutal-button bg-white"
												href={actionData.upload.share.files[0].downloadUrl}
											>
												BAIXAR UNICO
											</a>
										) : null}
									</div>
								</div>
							) : (
								<p className="mt-5 text-lg font-medium">
									O proximo share gerado aparece aqui com QR pronto e atalhos
									para abrir o lote.
								</p>
							)}
						</section>
					</aside>
				</div>
			</section>
		</main>
	);
}

async function extractApiError(response: Response): Promise<string> {
	try {
		const payload = (await response.json()) as { error?: string };
		if (payload.error) {
			return payload.error;
		}
	} catch {
		// Ignore JSON parsing failures and fall back to status text.
	}

	return response.statusText || "Nao foi possivel concluir o upload.";
}
