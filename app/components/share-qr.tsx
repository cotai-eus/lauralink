import { startTransition, useEffect, useState } from "react";

type ShareQrProps = {
	shareUrl: string;
	className?: string;
	label?: string;
};

export function ShareQr({
	shareUrl,
	className,
	label = "QR code do share",
}: ShareQrProps) {
	const [qrSvg, setQrSvg] = useState<string | null>(null);

	useEffect(() => {
		let isDisposed = false;

		startTransition(() => {
			setQrSvg(null);
		});

		void import("qrcode")
			.then(({ default: QRCode }) =>
				QRCode.toString(shareUrl, {
					type: "svg",
					errorCorrectionLevel: "M",
					margin: 1,
					color: {
						dark: "#000000ff",
						light: "#ffffffff",
					},
				}),
			)
			.then((nextQrSvg) => {
				if (isDisposed) {
					return;
				}

				startTransition(() => {
					setQrSvg(nextQrSvg);
				});
			})
			.catch((error) => {
				console.error("share_qr_render_failed", error);
			});

		return () => {
			isDisposed = true;
		};
	}, [shareUrl]);

	return (
		<div aria-label={label} className={className}>
			{qrSvg ? (
				<div dangerouslySetInnerHTML={{ __html: qrSvg }} />
			) : (
				<div className="brutal-card bg-[var(--color-cream)] p-4 text-center text-xs font-bold uppercase tracking-[0.2em]">
					QR carregando
				</div>
			)}
		</div>
	);
}