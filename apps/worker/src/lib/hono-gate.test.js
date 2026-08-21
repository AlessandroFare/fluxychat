import { describe, expect, it } from "vitest";
import { createHttpGateApp, MAX_HTTP_BODY_BYTES } from "./hono-gate.js";

describe("createHttpGateApp", () => {
  it("rejects oversized Content-Length before inner fetch", async () => {
    let innerCalled = false;
    const app = createHttpGateApp(async () => {
      innerCalled = true;
      return new Response("ok");
    });
    const res = await app.fetch(
      new Request("https://x/messages", {
        method: "POST",
        headers: { "content-length": String(MAX_HTTP_BODY_BYTES + 1) },
      }),
      { NODE_ENV: "production" },
      { waitUntil() {} },
    );
    expect(res.status).toBe(413);
    expect(innerCalled).toBe(false);
  });

  it("rejects /admin without Bearer when admin auth is required", async () => {
    const app = createHttpGateApp(async () => new Response("ok"));
    const res = await app.fetch(
      new Request("https://x/admin/reports"),
      { NODE_ENV: "production" },
      { waitUntil() {} },
    );
    expect(res.status).toBe(401);
  });

  it("passes through authenticated admin requests", async () => {
    const app = createHttpGateApp(async () => new Response("ok", { status: 200 }));
    const res = await app.fetch(
      new Request("https://x/admin/reports", {
        headers: { authorization: "Bearer test" },
      }),
      { NODE_ENV: "production" },
      { waitUntil() {} },
    );
    expect(res.status).toBe(200);
  });
});
