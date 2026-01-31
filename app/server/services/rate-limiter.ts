import { Context } from "hono";

export class RateLimiter {
  private env: { RATE_LIMITER: DurableObjectStub };
  private requestKey: string;

  constructor(env: { RATE_LIMITER: DurableObjectStub }, requestKey: string) {
    this.env = env;
    this.requestKey = requestKey;
  }

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const stub = this.env.RATE_LIMITER.get(key);
    const response = await stub.fetch("http://limiter/check", {
      method: "POST",
      body: JSON.stringify({ limit, windowSeconds }),
    });

    const data = (await response.json()) as { allowed: boolean };
    return data.allowed;
  }
}

export function extractClientIp(c: Context): string {
  const cfConnectingIp = c.req.header("cf-connecting-ip");
  const xForwardedFor = c.req.header("x-forwarded-for");
  const ip = cfConnectingIp || xForwardedFor?.split(",")[0] || "unknown";
  return ip.trim();
}

export function extractUserAgent(c: Context): string | null {
  return c.req.header("user-agent") || null;
}
