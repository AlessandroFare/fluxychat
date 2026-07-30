import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidServerRealtimeEventFrame } from "@fluxy-chat/protocol";

vi.mock("./room-shard.js", () => ({
  fanoutRoomInternal: vi.fn(async () => {}),
}));

import { fanoutRoomInternal } from "./room-shard.js";
import { fanoutServerEvent } from "./message-realtime-fanout.js";
import { createHybridEvent } from "./hybrid-events.js";
import { createPoll } from "./polls-forms.js";
import { createBreakout } from "./breakout-rooms.js";
import { recordVoiceAiMetrics, getVoiceAiStats } from "./voice-ai-pipeline.js";

function createPollDb() {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async run() {
                return { meta: { changes: String(sql).includes("INSERT") ? 1 : 0 } };
              },
            };
          },
        };
      },
    },
  };
}

function createBreakoutDb() {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async run() {
                return { meta: { changes: String(sql).includes("INSERT") ? 1 : 0 } };
              },
              async first() {
                return null;
              },
            };
          },
        };
      },
    },
  };
}

function createHybridDbEnv() {
  return {
    DB: {
      prepare(sql) {
        const isInsert = String(sql).includes("INSERT INTO hybrid_events");
        return {
          bind() {
            return {
              async run() {
                return { meta: { changes: isInsert ? 1 : 0 } };
              },
              async first() {
                return null;
              },
            };
          },
        };
      },
    },
  };
}

describe("RT-EX realtime smoke", () => {
  beforeEach(() => {
    vi.mocked(fanoutRoomInternal).mockClear();
  });

  it("fanoutServerEvent emits protocol-valid server_event body", async () => {
    const announced = [];
    vi.mocked(fanoutRoomInternal).mockImplementation(async (_env, _projectId, _roomId, _path, init) => {
      announced.push(JSON.parse(init.body));
    });

    await fanoutServerEvent({}, {
      projectId: "proj_1",
      roomId: "room_1",
      name: "poll.created",
      userId: "teacher",
      data: { pollId: "p1" },
    });

    expect(announced).toHaveLength(1);
    expect(isValidServerRealtimeEventFrame(announced[0])).toBe(true);
    expect(announced[0].name).toBe("poll.created");
  });

  it("createPoll fans out poll.created (Edu live workspace path)", async () => {
    const announced = [];
    vi.mocked(fanoutRoomInternal).mockImplementation(async (_env, _projectId, _roomId, _path, init) => {
      announced.push(JSON.parse(init.body));
    });

    const result = await createPoll(createPollDb(), {
      projectId: "proj_edu",
      roomId: "classroom_1",
      createdBy: "teacher",
      title: "Quick check",
      options: ["A", "B", "C"],
    });

    expect(result.ok).toBe(true);
    expect(announced.some((f) => f.name === "poll.created")).toBe(true);
  });

  it("createBreakout fans out edu.breakout.created", async () => {
    const announced = [];
    vi.mocked(fanoutRoomInternal).mockImplementation(async (_env, _projectId, _roomId, _path, init) => {
      announced.push(JSON.parse(init.body));
    });

    const result = await createBreakout(createBreakoutDb(), {
      projectId: "proj_edu",
      parentRoomId: "classroom_1",
      name: "Group A",
      createdBy: "teacher",
    });

    expect(result.ok).toBe(true);
    expect(announced.some((f) => f.name === "edu.breakout.created")).toBe(true);
  });

  it("hybrid event create fans out event.hybrid.created", async () => {
    const announced = [];
    vi.mocked(fanoutRoomInternal).mockImplementation(async (_env, _projectId, _roomId, _path, init) => {
      announced.push(JSON.parse(init.body));
    });

    const result = await createHybridEvent(createHybridDbEnv(), {
      projectId: "proj_1",
      roomId: "venue_main",
      name: "Summit 2026",
      mode: "hybrid",
    });

    expect(result.id).toBeTruthy();
    expect(announced.some((f) => f.name === "event.hybrid.created")).toBe(true);
  });

  it("voice metrics aggregate under-300ms samples", async () => {
    const store = new Map();
    const env = {
      RATE_LIMIT_KV: {
        async get(key) {
          return store.get(key) ?? null;
        },
        async put(key, value) {
          store.set(key, value);
        },
      },
    };

    await recordVoiceAiMetrics(env, {
      projectId: "proj_voice",
      sessionId: "vas_1",
      providerId: "openai-realtime",
      totalLatencyMs: 245,
      stages: [{ stage: "asr", durationMs: 80 }],
    });
    await recordVoiceAiMetrics(env, {
      projectId: "proj_voice",
      sessionId: "vas_2",
      providerId: "openai-realtime",
      totalLatencyMs: 420,
      stages: [],
    });

    const stats = await getVoiceAiStats(env, { projectId: "proj_voice" });
    expect(stats.sampleCount).toBe(2);
    expect(stats.under300Ms).toBe(1);
    expect(stats.avgLatencyMs).toBeGreaterThan(0);
  });
});
