import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy } from "./ops-policy.js";
import { startOpsRun } from "./ops-engine.js";
import { signHitlTapToken } from "./hitl-tap-token.js";
import { handlePublicOpsApprovalTap } from "./ops-approval-tap-http.js";

const TAP_SECRET = "tap-secret";

const approvalDef = {
  slug: "approve-write",
  steps: [
    { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
    { id: "end", type: "end", timeout: { after: "1s" } },
  ],
};

/** A run paused on its approval step, with a store-backed env for the tap route. */
async function waitingRun() {
  const store = createMemoryOpsStore();
  const projectId = "p1";
  await store.putPolicy(projectId, defaultOpsPolicy(), "admin");
  const def = await store.createDefinition({ projectId, slug: approvalDef.slug, createdBy: "u1" });
  const version = await store.saveVersion({
    projectId,
    definitionId: def.id,
    version: 1,
    status: "published",
    definition: approvalDef,
    createdBy: "u1",
    publishedBy: "admin",
  });
  const run = await startOpsRun(store, {
    projectId,
    version,
    actor: "u1",
    roomId: "room-1",
    executeTool: async () => ({ ok: true }),
  });
  const approval = await store.getApproval(projectId, run.context.approvalId);
  const env = {
    OPS_STORE: store,
    JWT_SECRET: "s",
    RATE_LIMIT_FALLBACK_ALLOW: "true",
    ART50_MARK_SECRET: TAP_SECRET,
    DB: nonceDB(),
  };
  return { store, projectId, run, approval, env };
}

/** Single-use nonce table: the second insert of the same jti fails like the real UNIQUE. */
function nonceDB() {
  const used = new Set();
  return {
    prepare: () => ({
      bind: (jti) => ({
        run: async () => {
          if (used.has(jti)) throw new Error("UNIQUE constraint failed");
          used.add(jti);
          return { meta: { changes: 1 } };
        },
      }),
    }),
    _used: used,
  };
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "content-type": "application/json" },
  });
}

function tapCall(method, token, accept = "application/json") {
  const url = new URL(`https://api.example/public/ops/approvals/tap?token=${encodeURIComponent(token)}`);
  if (method === "GET") {
    return { request: new Request(url, { method, headers: { accept } }), url };
  }
  return {
    request: new Request(url, {
      method,
      headers: { accept, "content-type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(token)}`,
    }),
    url,
  };
}

function tokenFor(payload, { secret = TAP_SECRET, action = "approve" } = {}) {
  return signHitlTapToken(secret, {
    action,
    userId: "u1",
    exp: Date.now() + 60_000,
    kind: "ops",
    projectId: "p1",
    ...payload,
  });
}

describe("ops-approval-tap-http", () => {
  it("GET renders a confirmation form and records nothing", async () => {
    const { store, approval, env } = await waitingRun();
    const token = await tokenFor({ approvalId: approval.id, payloadHash: approval.payloadHash });
    const { request, url } = tapCall("GET", token, "text/html");

    const res = await handlePublicOpsApprovalTap(request, url, env, json, {});
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="post"');
    expect((await store.getApproval("p1", approval.id)).status).toBe("pending");
  });

  it("POST approves once and resumes the run", async () => {
    const { store, run, approval, env } = await waitingRun();
    const token = await tokenFor({ approvalId: approval.id, payloadHash: approval.payloadHash });
    const { request, url } = tapCall("POST", token);

    const res = await handlePublicOpsApprovalTap(request, url, env, json, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect((await store.getApproval("p1", approval.id)).status).toBe("approved");
    expect((await store.getRun("p1", run.id)).status).toBe("done");
    const events = await store.listEvents("p1", run.id);
    expect(events.map((event) => event.eventType)).toContain("ops.approval.granted");
  });

  it("burns the link after one use and refuses a second, different link", async () => {
    const { store, approval, env } = await waitingRun();
    const token = await tokenFor({ approvalId: approval.id, payloadHash: approval.payloadHash });
    const first = tapCall("POST", token);
    await handlePublicOpsApprovalTap(first.request, first.url, env, json, {});

    const replay = tapCall("POST", token);
    const replayRes = await handlePublicOpsApprovalTap(replay.request, replay.url, env, json, {});
    expect(replayRes.status).toBe(409);
    expect(await replayRes.json()).toMatchObject({ error: "token_already_used" });

    const other = tapCall("POST", await tokenFor({ approvalId: approval.id, payloadHash: approval.payloadHash }, { action: "deny" }));
    const otherRes = await handlePublicOpsApprovalTap(other.request, other.url, env, json, {});
    expect(otherRes.status).toBe(409);
    expect(await otherRes.json()).toMatchObject({ error: "already_decided" });
    expect((await store.getApproval("p1", approval.id)).status).toBe("approved");
  });

  it("rejects a changed payload hash without voiding the approval", async () => {
    const { store, approval, env } = await waitingRun();
    const token = await tokenFor({ approvalId: approval.id, payloadHash: "other-hash" });
    const { request, url } = tapCall("POST", token);

    const res = await handlePublicOpsApprovalTap(request, url, env, json, {});
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "payload_changed" });
    expect((await store.getApproval("p1", approval.id)).status).toBe("pending");
  });

  it("rejects tokens from another flow, another secret, or after expiry", async () => {
    const { approval, env } = await waitingRun();
    const hitlStyle = await signHitlTapToken(TAP_SECRET, {
      approvalId: approval.id,
      action: "approve",
      userId: "u1",
      exp: Date.now() + 60_000,
      payloadHash: approval.payloadHash,
    });
    const wrongSecret = await tokenFor({ approvalId: approval.id, payloadHash: approval.payloadHash }, { secret: "other" });
    const expired = await signHitlTapToken(TAP_SECRET, {
      approvalId: approval.id,
      action: "approve",
      userId: "u1",
      exp: Date.now() - 1000,
      payloadHash: approval.payloadHash,
      kind: "ops",
      projectId: "p1",
    });
    for (const token of [hitlStyle, wrongSecret, expired, "not-a-token"]) {
      const { request, url } = tapCall("POST", token);
      const res = await handlePublicOpsApprovalTap(request, url, env, json, {});
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "invalid_token" });
    }
  });
});
