import { describe, it, expect, vi } from "vitest";
import {
  ingestProsodySignal,
  buildEmpathyPromptSuffix,
  upsertRoomEmpathySettings,
} from "./room-empathy.js";

vi.mock("./room-access.js", () => ({
  canAccessRoom: vi.fn(async () => true),
}));

function makeEnv() {
  const kvStore = new Map();
  const settings = new Map();
  return {
    env: {
      RATE_LIMIT_KV: {
        put: vi.fn(async (key, val) => { kvStore.set(key, val); }),
        get: vi.fn(async (key) => kvStore.get(key) ?? null),
      },
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            first: vi.fn(async () => {
              if (sql.includes("room_empathy_settings") && sql.includes("SELECT")) {
                const key = `${args[0]}:${args[1]}`;
                return settings.get(key) ?? null;
              }
              return null;
            }),
            run: vi.fn(async () => {
              if (sql.includes("INSERT INTO room_empathy_settings")) {
                const key = `${args[0]}:${args[1]}`;
                settings.set(key, {
                  enabled: args[2],
                  min_confidence: args[3],
                  escalate_on_stressed: args[4],
                  updated_at: args[5],
                });
              }
            }),
          })),
        })),
      },
    },
    kvStore,
    settings,
  };
}

describe("room-empathy", () => {
  it("stores signal when enabled and confidence sufficient", async () => {
    const { env, settings } = makeEnv();
    settings.set("p1:r1", { enabled: 1, min_confidence: 0.5, escalate_on_stressed: 1, updated_at: "t" });

    const result = await ingestProsodySignal(env, { projectId: "p1", userId: "u1" }, {
      roomId: "r1",
      inferredState: "frustrated",
      confidence: 0.8,
      pitchVariance: 0.2,
      speechRate: 0.8,
      pauseRatio: 0.1,
    });
    expect(result.ok).toBe(true);
    expect(result.accepted).toBe(true);
  });

  it("builds prompt suffix from kv signal", async () => {
    const { env, settings, kvStore } = makeEnv();
    settings.set("p1:r1", { enabled: 1, min_confidence: 0.5, escalate_on_stressed: 1, updated_at: "t" });
    kvStore.set(
      "empathy:p1:r1:u1",
      JSON.stringify({ inferredState: "stressed", confidence: 0.9 }),
    );

    const suffix = await buildEmpathyPromptSuffix(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
    });
    expect(suffix).toContain("silently");
  });

  it("upserts settings", async () => {
    const { env } = makeEnv();
    const settings = await upsertRoomEmpathySettings(env, "p1", "r1", { enabled: true });
    expect(settings.enabled).toBe(true);
  });
});
