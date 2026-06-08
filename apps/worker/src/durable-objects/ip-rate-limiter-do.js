/**
 * Per-scope IP rate limiter (one DO instance per key, e.g. ws:1.2.3.4).
 * Persists bucket in DO storage with alarm-based TTL cleanup.
 */
export class IpRateLimiterDurableObject {
  constructor(state, _env) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/check" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const limit = Number(url.searchParams.get("limit") || "60");
    const windowMs = Number(url.searchParams.get("windowMs") || "60000");
    const result = await this.consume(limit, windowMs);
    return Response.json(result, {
      headers: { "Content-Type": "application/json" },
    });
  }

  async consume(limit, windowMs) {
    if (!Number.isFinite(limit) || limit <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const safeWindowMs = Math.max(1_000, Number.isFinite(windowMs) ? windowMs : 60_000);
    const now = Date.now();
    /** @type {{ count: number, expiresAt: number } | null} */
    let bucket = await this.state.storage.get("bucket");
    if (!bucket || bucket.expiresAt <= now) {
      bucket = { count: 1, expiresAt: now + safeWindowMs };
      await this.state.storage.put("bucket", bucket);
      await this.scheduleAlarm(bucket.expiresAt);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      };
    }
    bucket.count += 1;
    await this.state.storage.put("bucket", bucket);
    await this.scheduleAlarm(bucket.expiresAt);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async scheduleAlarm(expiresAt) {
    if (typeof this.state.storage.setAlarm !== "function") return;
    const when = expiresAt + 1_000;
    const current = await this.state.storage.getAlarm();
    if (!current || current > when) {
      await this.state.storage.setAlarm(when);
    }
  }

  async alarm() {
    const bucket = await this.state.storage.get("bucket");
    if (!bucket || bucket.expiresAt <= Date.now()) {
      await this.state.storage.delete("bucket");
      if (typeof this.state.storage.deleteAlarm === "function") {
        await this.state.storage.deleteAlarm();
      }
    }
  }
}
