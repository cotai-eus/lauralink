import { PASSWORD_PBKDF2_ITERATIONS } from "../app/lib/files";

const encoder = new TextEncoder();

export type PasswordDigest = {
	salt: string;
	hash: string;
	iterations: number;
};

export async function createPasswordDigest(password: string): Promise<PasswordDigest> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derivePasswordHash(password, salt, PASSWORD_PBKDF2_ITERATIONS);

	return {
		salt: bytesToBase64(salt),
		hash: bytesToBase64(hash),
		iterations: PASSWORD_PBKDF2_ITERATIONS,
	};
}

export async function verifyPasswordDigest(
	password: string,
	digest: PasswordDigest,
): Promise<boolean> {
	const expectedHash = base64ToBytes(digest.hash);
	const salt = base64ToBytes(digest.salt);
	const actualHash = await derivePasswordHash(password, salt, digest.iterations);

	return timingSafeEqual(actualHash, expectedHash);
}

async function derivePasswordHash(
	password: string,
	salt: Uint8Array,
	iterations: number,
): Promise<Uint8Array> {
	const baseKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			salt: new Uint8Array(salt),
			iterations,
		},
		baseKey,
		256,
	);

	return new Uint8Array(derivedBits);
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) {
		return false;
	}

	let result = 0;

	for (let index = 0; index < left.length; index += 1) {
		result |= left[index] ^ right[index];
	}

	return result === 0;
}
