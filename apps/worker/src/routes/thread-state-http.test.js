import { describe, expect, it } from "vitest";
import { dispatchThreadStateRoutes } from "./thread-state-http.js";

function buildDeps() {
  const puts = [];
  return {
    puts,
    h: {
      env: {
        KV: {
          put: async (key, value, options) => {
            puts.push({ key, value, options });
          },
          get: async () => null,
          delete: async () => {},
        },
      },
      json: (body, init = {}) =>
        new Response(JSON.stringify(body), {
          status: init.status ?? 200,
          headers: { "Content-Type": "application/json" },
        }),
      corsHeaders: {},
      verifyJwtAndGetContext: async () => ({
        projectId: "proj_own",
        userId: "u1",
        roles: ["member"],
      }),
    },
  };
}

function putRequest(body) {
  return new Request("https://worker.example/api/threads/t1/state", {
    method: "PUT",
    headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/threads/:id/state ttl (A2-27)", () => {
  it("A2-27: rejects a non-numeric ttlMs instead of storing a permanent entry", async () => {
    const { h, puts } = buildDeps();
    const res = await dispatchThreadStateRoutes(
      putRequest({ state: { a: 1 }, ttlMs: "abc" }),
      new URL("https://worker.example/api/threads/t1/state"),
      h,
    );
    expect(res.status).toBe(400);
    expect(puts).toHaveLength(0);
  });

  it("A2-27 control: a numeric ttlMs is stored with an expiration", async () => {
    const { h, puts } = buildDeps();
    const res = await dispatchThreadStateRoutes(
      putRequest({ state: { a: 1 }, ttlMs: 60_000 }),
      new URL("https://worker.example/api/threads/t1/state"),
      h,
    );
    expect(res.status).toBe(200);
    expect(puts[0].options).toEqual({ expirationTtl: 60 });
  });
});
