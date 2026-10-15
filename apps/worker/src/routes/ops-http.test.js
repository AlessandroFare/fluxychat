import { describe, expect, it } from "vitest";
import { dispatchOpsRoutes, getOpsStore } from "./ops-http.js";
import { createMemoryOpsStore } from "../lib/ops-store.js";

function h(store) {
  return {
    env: { OPS_STORE: store, JWT_SECRET: "s" },
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["admin"] }),
    logError: () => {},
    requestLogCtx: {},
  };
}

async function post(store, path, body) {
  const res = await dispatchOpsRoutes(
    new Request(`https://x${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }),
    new URL(`https://x${path}`),
    h(store),
  );
  return { res, data: await res.json() };
}

async function get(store, path) {
  const res = await dispatchOpsRoutes(new Request(`https://x${path}`), new URL(`https://x${path}`), h(store));
  return { res, data: await res.json() };
}

async function patch(store, path, body) {
  const res = await dispatchOpsRoutes(
    new Request(`https://x${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }),
    new URL(`https://x${path}`),
    h(store),
  );
  return { res, data: await res.json() };
}

describe("ops-http", () => {
  it("builds from chat and refuses builder publish", async () => {
    const store = createMemoryOpsStore();
    const chat = await post(store, "/ops/builder/sessions", {
      text: "When PTO is requested, manager approves and notify HR",
    });
    expect(chat.res.status).toBe(200);
    expect(chat.data.drafted.lint.ok).toBe(true);
    const forbidden = await post(store, "/ops/builder/tools", { name: "publish" });
    expect(forbidden.data.ok).toBe(false);
  });

  it("prefers an injected store over D1", () => {
    const store = createMemoryOpsStore();
    const env = {
      OPS_STORE: store,
      DB: {
        prepare() {
          throw new Error("d1_should_not_run");
        },
      },
    };
    expect(getOpsStore(env)).toBe(store);
  });

  it("uses D1 when no store is injected", () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => null,
                all: async () => ({ results: [] }),
                run: async () => ({}),
              };
            },
          };
        },
      },
    };
    expect(getOpsStore(env).kind).toBe("d1");
  });

  it("lists runs after human publish", async () => {
    const store = createMemoryOpsStore();
    const chat = await post(store, "/ops/builder/sessions", {
      text: "When PTO is requested, manager approves and notify HR",
    });
    const versionId = chat.data.drafted.version.id;
    const req = await post(store, "/ops/builder/publish-request", { versionId });
    expect(req.data.approvalId).toBeTruthy();
    const decided = await post(store, `/ops/approvals/${req.data.approvalId}/decide`, {
      decision: "approve",
      payloadHash: versionId,
    });
    expect(decided.data.ok).toBe(true);
    const published = await post(store, "/ops/builder/publish", { approvalId: req.data.approvalId });
    expect(published.data.published.status).toBe("published");
    const started = await post(store, "/ops/runs", { versionId });
    expect(started.data.run.id).toBeTruthy();
    const listed = await get(store, "/ops/runs");
    expect(listed.data.runs.length).toBeGreaterThan(0);
    const patched = await patch(store, "/ops/tools", { name: "notify.send", enabled: false });
    expect(patched.data.tool.enabled).toBe(false);
    const invited = await post(store, "/ops/guests/invite", {
      runId: started.data.run.id,
      email: "auditor@partner.example",
      can: ["comment", "upload_file"],
    });
    expect(invited.data.token).toBeTruthy();
    expect(invited.data.can).toEqual(["comment", "upload_file"]);
    const redeemed = await post(store, "/ops/guest/redeem", {
      projectId: "p1",
      token: invited.data.token,
    });
    expect(redeemed.data.ok).toBe(true);
    const sources = await get(store, "/ops/sources");
    expect(sources.data.namedViews.length).toBeGreaterThan(0);
    expect(sources.data.aiSearch).toBe(false);
  });
});
