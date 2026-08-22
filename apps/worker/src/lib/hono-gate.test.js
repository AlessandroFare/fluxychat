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

  it("lets CORS preflight through /admin without Bearer", async () => {
    let innerCalled = false;
    const app = createHttpGateApp(async () => {
      innerCalled = true;
      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "https://fluxychat.com" },
      });
    });
    const res = await app.fetch(
      new Request("https://x/admin/webhooks", {
        method: "OPTIONS",
        headers: {
          Origin: "https://fluxychat.com",
          "Access-Control-Request-Method": "GET",
        },
      }),
      { NODE_ENV: "production" },
      { waitUntil() {} },
    );
    expect(innerCalled).toBe(true);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://fluxychat.com");
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
