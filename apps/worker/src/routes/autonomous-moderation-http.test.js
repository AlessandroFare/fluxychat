import { describe, expect, it } from "vitest";
import { dispatchAutonomousModRoutes } from "./autonomous-moderation-http.js";

function buildHarness({ roles }) {
  return {
    env: {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => null,
                all: async () => ({ results: [] }),
                run: async () => ({ meta: { changes: 1 } }),
              };
            },
          };
        },
      },
    },
    corsHeaders: {},
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init?.status || 200,
        headers: { "content-type": "application/json" },
      }),
    hasAnyRole: (rolesList, allowed) => rolesList.some((r) => allowed.includes(r)),
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles }),
  };
}

function post(path, body) {
  return new Request(`http://127.0.0.1:8787${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(path, body) {
  return new Request(`http://127.0.0.1:8787${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("autonomous moderation role gate (A2d)", () => {
  it("rejects a guest creating an auto-mod rule", async () => {
    const req = post("/auto-mod/rules", { name: "Spam" });
    const res = await dispatchAutonomousModRoutes(req, new URL(req.url), buildHarness({ roles: ["guest"] }));
    expect(res.status).toBe(403);
  });

  it("rejects a plain member patching an auto-mod rule", async () => {
    const req = patch("/auto-mod/rules/rule-1", { name: "Spam" });
    const res = await dispatchAutonomousModRoutes(req, new URL(req.url), buildHarness({ roles: ["member"] }));
    expect(res.status).toBe(403);
  });

  it("rejects a plain member triggering moderation evaluation", async () => {
    const req = post("/auto-mod/evaluate", {
      roomId: "r1",
      userId: "victim",
      messageId: "m1",
      severity: "high",
      confidence: 0.9,
    });
    const res = await dispatchAutonomousModRoutes(req, new URL(req.url), buildHarness({ roles: ["member"] }));
    expect(res.status).toBe(403);
  });

  it("lets a moderator create an auto-mod rule", async () => {
    const req = post("/auto-mod/rules", { name: "Spam" });
    const res = await dispatchAutonomousModRoutes(req, new URL(req.url), buildHarness({ roles: ["moderator"] }));
    expect(res.status).toBe(201);
  });

  it("keeps rule listing readable for plain members", async () => {
    const req = new Request("http://127.0.0.1:8787/auto-mod/rules");
    const res = await dispatchAutonomousModRoutes(req, new URL(req.url), buildHarness({ roles: ["member"] }));
    expect(res.status).toBe(200);
  });
});
