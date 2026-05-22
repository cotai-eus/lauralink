import QRCode from "qrcode/lib/browser.js";

export async function renderShareQrSvg(shareUrl: string): Promise<string> {
	return QRCode.toString(shareUrl, {
		type: "svg",
		errorCorrectionLevel: "M",
		margin: 1,
		color: {
			dark: "#000000ff",
			light: "#ffffffff",
		},
	});
}
