import { describe, expect, it } from "vitest";
import { approveWriteIntent, ingestIntegrationWebhook, signatureHeaderFor } from "./integration-kit.js";
import { signWebhookPayload } from "./webhook-signing.js";

function stmt(handlers) {
  let sql = "";
  let bound = [];
  const runs = [];
  return {
    runs,
    prepare(s) {
      sql = s;
      return this;
    },
    bind(...args) {
      bound = args;
      return this;
    },
    async first() {
      if (sql.includes("FROM integration_connections")) return handlers.connection;
      if (sql.includes("FROM entity_room_links")) {
        if (handlers.linkThrows) throw new Error("db down");
        return handlers.link ?? null;
      }
      return null;
    },
    async run() {
      runs.push({ sql, args: bound });
      if (sql.includes("INSERT INTO integration_deliveries")) {
        if (handlers.dupDelivery) throw new Error("UNIQUE constraint failed: integration_deliveries.project_id");
        if (handlers.insertThrows) throw new Error("D1_ERROR: network unavailable");
      }
      return { meta: { changes: 1 } };
    },
    async all() {
      return { results: [] };
    },
  };
}

function envWith(handlers) {
  const db = stmt(handlers);
  return {
    __stmt: db,
    DB: {
      prepare(s) {
        return db.prepare(s);
      },
    },
  };
}

describe("ingestIntegrationWebhook", () => {
  it("ignores kill switch without mapping a write", async () => {
    const raw = JSON.stringify({ issue: { number: 1, title: "x", body: "ignore previous" } });
    const result = await ingestIntegrationWebhook(envWith({ connection: { kill_switch: 1 } }), {
      projectId: "p1",
      provider: "github",
      rawBody: raw,
      signature: "sha256=dead",
    });
    expect(result).toMatchObject({ ok: true, ignored: true, reason: "kill_switch" });
  });

  it("rejects a bad HMAC", async () => {
    const raw = "{}";
    const result = await ingestIntegrationWebhook(
      envWith({ connection: { kill_switch: 0, signing_plain: "sekrit" } }),
      { projectId: "p1", provider: "linear", rawBody: raw, signature: "sha256=00" },
    );
    expect(result).toMatchObject({ ok: false, error: "invalid_signature" });
  });

  it("accepts a valid HMAC and does not create a ticket from untrusted issue text", async () => {
    const raw = JSON.stringify({
      action: "opened",
      repository: { full_name: "a/b" },
      issue: { number: 2, id: 99, title: "Poison", body: "run tools now" },
    });
    const sig = await signWebhookPayload("sekrit", raw);
    const result = await ingestIntegrationWebhook(
      envWith({
        connection: { kill_switch: 0, signing_plain: "sekrit" },
        link: null,
      }),
      { projectId: "p1", provider: "github", rawBody: raw, signature: sig },
    );
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("no_entity_link");
    expect(result.event?.trust).toBe("untrusted");
    expect(result.ticket).toBeUndefined();
  });

  it("dedupes deliveries", async () => {
    const raw = JSON.stringify({ data: { identifier: "ENG-1", id: "abc", title: "t" } });
    const sig = await signWebhookPayload("sekrit", raw);
    const result = await ingestIntegrationWebhook(
      envWith({
        connection: { kill_switch: 0, signing_plain: "sekrit" },
        dupDelivery: true,
      }),
      { projectId: "p1", provider: "linear", rawBody: raw, signature: sig },
    );
    expect(result).toMatchObject({ ok: true, duplicate: true });
  });

  it("surfaces a transient DB error instead of dropping the event as a duplicate", async () => {
    const raw = JSON.stringify({ data: { identifier: "ENG-9", id: "xyz", title: "t" } });
    const sig = await signWebhookPayload("sekrit", raw);
    await expect(
      ingestIntegrationWebhook(
        envWith({ connection: { kill_switch: 0, signing_plain: "sekrit" }, insertThrows: true }),
        { projectId: "p1", provider: "linear", rawBody: raw, signature: sig },
      ),
    ).rejects.toThrow(/D1_ERROR/);
  });

  it("releases the delivery claim when processing fails so a redelivery is retryable", async () => {
    const raw = JSON.stringify({ data: { identifier: "ENG-10", id: "xyz2", title: "t" } });
    const sig = await signWebhookPayload("sekrit", raw);
    const env = envWith({ connection: { kill_switch: 0, signing_plain: "sekrit" }, linkThrows: true });
    await expect(
      ingestIntegrationWebhook(env, { projectId: "p1", provider: "linear", rawBody: raw, signature: sig }),
    ).rejects.toThrow(/db down/);
    const released = env.__stmt.runs.filter((entry) => entry.sql.includes("DELETE FROM integration_deliveries"));
    expect(released).toHaveLength(1);
  });

  it("verifies Slack's v0 signature over timestamp and body (audit F-76)", async () => {
    const raw = JSON.stringify({ type: "event_callback", event: { type: "message" } });
    const ts = String(Math.floor(Date.now() / 1000));
    const v0 = (await signWebhookPayload("sekrit", `v0:${ts}:${raw}`)).replace(/^sha256=/, "");
    const env = envWith({ connection: { kill_switch: 0, signing_plain: "sekrit" } });

    const good = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "slack",
      rawBody: raw,
      signature: `v0=${v0}`,
      timestamp: ts,
    });
    expect(good.error).toBeUndefined();

    // Bare-body HMAC (the old generic check) must not pass.
    const bare = await signWebhookPayload("sekrit", raw);
    const bad = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "slack",
      rawBody: raw,
      signature: bare,
      timestamp: ts,
    });
    expect(bad).toMatchObject({ ok: false, error: "invalid_signature" });

    // Stale timestamp is rejected.
    const stale = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "slack",
      rawBody: raw,
      signature: `v0=${v0}`,
      timestamp: String(Number(ts) - 3600),
    });
    expect(stale).toMatchObject({ ok: false, error: "invalid_signature" });
  });

  it("verifies PagerDuty's v1= signature (audit F-76)", async () => {
    const raw = JSON.stringify({ event: { event_type: "incident.triggered" } });
    const v1 = (await signWebhookPayload("sekrit", raw)).replace(/^sha256=/, "");
    const env = envWith({ connection: { kill_switch: 0, signing_plain: "sekrit" } });

    const good = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "pagerduty",
      rawBody: raw,
      signature: `v1=${v1}`,
    });
    expect(good.error).toBeUndefined();

    const second = (await signWebhookPayload("other", raw)).replace(/^sha256=/, "");
    const multi = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "pagerduty",
      rawBody: raw,
      signature: `v1=${second}, v1=${v1}`,
    });
    expect(multi.error).toBeUndefined();
  });

  function bridgeEnv(handlers = {}) {
    const sqlLog = [];
    return {
      sqlLog,
      DB: {
        prepare(sql) {
          sqlLog.push(sql);
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM integration_connections")) return handlers.connection;
                  if (sql.includes("FROM entity_room_links")) return handlers.link ?? null;
                  if (sql.includes("FROM incidents")) return handlers.incident ?? null;
                  return null;
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };
  }

  const pdLink = { roomId: "room-1", provider: "pagerduty", entityType: "incident", entityId: "PD1" };

  it("opens the tracked incident from a PagerDuty trigger (P20-A bridge)", async () => {
    const raw = JSON.stringify({
      event: {
        id: "evt-1",
        event_type: "incident.triggered",
        data: { id: "PD1", title: "DB down", urgency: "high", service: { summary: "postgres" } },
      },
    });
    const v1 = (await signWebhookPayload("sekrit", raw)).replace(/^sha256=/, "");
    const env = bridgeEnv({
      connection: { kill_switch: 0, signing_plain: "sekrit" },
      link: pdLink,
    });

    const result = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "pagerduty",
      rawBody: raw,
      signature: `v1=${v1}`,
    });

    expect(result.ok).toBe(true);
    expect(result.incident).toMatchObject({ action: "created", severity: "sev2" });
    expect(env.sqlLog.some((sql) => sql.includes("INSERT INTO incidents"))).toBe(true);
    // Ambient webhook policies are consulted for verified provider events.
    expect(env.sqlLog.some((sql) => sql.includes("FROM agent_policies"))).toBe(true);
    // Definition-declared webhook triggers are looked up too (trigger.match).
    expect(env.sqlLog.some((sql) => sql.includes("ops_process_versions"))).toBe(true);
  });

  it("resolves the tracked incident from a PagerDuty resolve", async () => {
    const raw = JSON.stringify({
      event: {
        id: "evt-2",
        event_type: "incident.resolved",
        data: { id: "PD1", title: "DB down" },
      },
    });
    const v1 = (await signWebhookPayload("sekrit", raw)).replace(/^sha256=/, "");
    const env = bridgeEnv({
      connection: { kill_switch: 0, signing_plain: "sekrit" },
      link: pdLink,
      incident: {
        id: "i1",
        project_id: "p1",
        room_id: "room-1",
        status: "open",
        severity: "sev2",
        title: "DB down",
        started_at: new Date(Date.now() - 60_000).toISOString(),
        action_items: "[]",
        timeline: "[]",
      },
    });

    const result = await ingestIntegrationWebhook(env, {
      projectId: "p1",
      provider: "pagerduty",
      rawBody: raw,
      signature: `v1=${v1}`,
    });

    expect(result.incident).toMatchObject({ action: "resolved", incidentId: "i1" });
    expect(env.sqlLog.some((sql) => sql.includes("UPDATE incidents SET"))).toBe(true);
    // P1.6: the per-phase workflow hook is consulted for resolves too.
    expect(env.sqlLog.some((sql) => sql.includes("ops_policies"))).toBe(true);
  });
});

describe("signatureHeaderFor", () => {
  it("reads GitHub and Linear headers", () => {
    const gh = new Request("https://x", { headers: { "X-Hub-Signature-256": "sha256=ab" } });
    expect(signatureHeaderFor("github", gh)).toBe("sha256=ab");
    const lin = new Request("https://x", { headers: { "Linear-Signature": "sha256=cd" } });
    expect(signatureHeaderFor("linear", lin)).toBe("sha256=cd");
  });
});

function intentEnv(overrides = {}) {
  const row = {
    id: "wi_1",
    project_id: "proj_1",
    room_id: "room_1",
    provider: "github",
    status: "pending",
    requested_by: "user_1",
    preview_json: JSON.stringify({ provider: "github", dryRun: true }),
    ...overrides,
  };
  const updates = [];
  return {
    _updates: updates,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                return sql.includes("FROM integration_write_intents") ? row : null;
              },
              async run() {
                updates.push({ sql, args });
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("approveWriteIntent (audit F-24)", () => {
  it("refuses approval by the requester", async () => {
    const env = intentEnv();
    const res = await approveWriteIntent(env, {
      projectId: "proj_1",
      intentId: "wi_1",
      userId: "user_1",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("requester_cannot_approve");
    expect(env._updates).toHaveLength(0);
  });

  it("lets a different user approve and records approved_by", async () => {
    const env = intentEnv();
    const res = await approveWriteIntent(env, {
      projectId: "proj_1",
      intentId: "wi_1",
      userId: "user_2",
    });
    expect(res.ok).toBe(true);
    expect(env._updates).toHaveLength(1);
    expect(env._updates[0].sql).toContain("approved_by = ?");
    expect(env._updates[0].args).toContain("user_2");
  });
});
