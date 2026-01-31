import { SignJWT, jwtVerify } from "jose";

export interface ShareToken {
  fileId: string;
  fileName: string;
  exp: number;
  iat: number;
}

const ALGORITHM = "HS256";

export class FileSigner {
  private secret: Uint8Array;
  private expiryDays: number;

  constructor(secretKey: string, expiryDays: number = 30) {
    this.secret = new TextEncoder().encode(secretKey.padEnd(32, "0"));
    this.expiryDays = expiryDays;
  }

  async sign(fileId: string, fileName: string): Promise<string> {
    const now = Date.now() / 1000;
    const exp = Math.floor(now + this.expiryDays * 24 * 60 * 60);

    return new SignJWT({ fileId, fileName })
      .setProtectedHeader({ alg: ALGORITHM })
      .setExpirationTime(exp)
      .setIssuedAt(Math.floor(now))
      .sign(this.secret);
  }

  async verify(token: string): Promise<ShareToken | null> {
    try {
      const verified = await jwtVerify(token, this.secret);
      return verified.payload as ShareToken;
    } catch {
      return null;
    }
  }

  generateFileId(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
