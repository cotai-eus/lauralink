interface RateLimit {
  count: number;
  resetAt: number;
}

export class UploadRateLimiter {
  state: DurableObjectState;
  env: Record<string, unknown>;

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/check" && request.method === "POST") {
      const body = (await request.json()) as {
        limit: number;
        windowSeconds: number;
      };
      return this.handleCheck(body.limit, body.windowSeconds);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleCheck(limit: number, windowSeconds: number): Promise<Response> {
    const now = Date.now();
    const data = (await this.state.storage?.get<RateLimit>("limit")) || {
      count: 0,
      resetAt: now + windowSeconds * 1000,
    };

    if (now > data.resetAt) {
      data.count = 0;
      data.resetAt = now + windowSeconds * 1000;
    }

    data.count++;
    await this.state.storage?.put("limit", data);

    const allowed = data.count <= limit;
    return new Response(JSON.stringify({ allowed, count: data.count, limit }), {
      headers: { "content-type": "application/json" },
    });
  }
}
