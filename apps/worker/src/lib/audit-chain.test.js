import { describe, it, expect } from "vitest";
import {
  AUDIT_CHAIN_GENESIS_HASH,
  appendRoomAuditChainEvent,
  exportAuditChainToR2,
  sha256Hex,
  verifyRoomAuditChain,
} from "./audit-chain.js";

function createEnv() {
  const chain = [];
  return {
    AUDIT_CHAIN_ENABLED: "true",
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("ORDER BY id DESC")) {
                  return chain.length ? { event_hash: chain[chain.length - 1].event_hash } : null;
                }
                return null;
              },
              async all() {
                if (sql.includes("ORDER BY id ASC")) {
                  const limit = args[1] ?? 5000;
                  return { results: chain.slice(0, limit).map((row, i) => ({ ...row, id: i + 1 })) };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO room_audit_chain")) {
                  chain.push({
                    project_id: args[0],
                    prev_hash: args[1],
                    event_hash: args[2],
                    event_json: args[3],
                    created_at: args[4],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("audit-chain", () => {
  it("has genesis hash constant", () => {
    expect(AUDIT_CHAIN_GENESIS_HASH).toHaveLength(64);
  });

  it("appends linked events", async () => {
    const env = createEnv();
    const first = await appendRoomAuditChainEvent(env, {
      projectId: "p1",
      event: { type: "test", action: "a" },
    });
    const second = await appendRoomAuditChainEvent(env, {
      projectId: "p1",
      event: { type: "test", action: "b" },
    });
    expect(first.ok).toBe(true);
    expect(second.prevHash).toBe(first.eventHash);
  });

  it("verifies intact chain", async () => {
    const env = createEnv();
    await appendRoomAuditChainEvent(env, { projectId: "p1", event: { n: 1 } });
    await appendRoomAuditChainEvent(env, { projectId: "p1", event: { n: 2 } });
    const result = await verifyRoomAuditChain(env, { projectId: "p1" });
    expect(result.valid).toBe(true);
    expect(result.count).toBe(2);
  });

  it("sha256Hex is deterministic", async () => {
    const a = await sha256Hex("fluxy");
    const b = await sha256Hex("fluxy");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("exportAuditChainToR2 writes to bucket", async () => {
    const env = createEnv();
    const puts = [];
    env.ATTACHMENTS = {
      put: async (key, body, opts) => {
        puts.push({ key, body: String(body), opts });
      },
    };
    await appendRoomAuditChainEvent(env, { projectId: "p1", event: { n: 1 } });
    const result = await exportAuditChainToR2(env, {
      projectId: "p1",
    });
    expect(result.ok).toBe(true);
    expect(puts).toHaveLength(1);
    expect(puts[0].key).toContain("audit-chain/p1/");
  });
});
