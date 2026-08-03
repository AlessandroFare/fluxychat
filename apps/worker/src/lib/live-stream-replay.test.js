import { describe, expect, it, vi } from "vitest";
import {
  eventSyncGroupId,
  getEventReplayBundle,
  getPrimaryEventReplay,
  listEventReplays,
  registerManualReplay,
} from "./live-stream-replay.js";

vi.mock("./message-realtime-fanout.js", () => ({
  fanoutServerEvent: vi.fn(async () => {}),
}));

vi.mock("./live-streaming.js", () => ({
  listLiveMessages: vi.fn(async () => []),
}));

function mockEnv(productRow = null) {
  const replays = new Map();
  return {
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...params) {
              return {
                async first() {
                  if (sql.includes("FROM live_events WHERE id")) {
                    return { id: params[0], room_id: "room-1" };
                  }
                  if (sql.includes("FROM live_stream_replays WHERE id = ? AND project_id")) {
                    return replays.get(params[0]) ?? null;
                  }
                  if (sql.includes("is_primary DESC, ready_at DESC")) {
                    return [...replays.values()].find((r) => r.status === "ready") ?? null;
                  }
                  return productRow;
                },
                async all() {
                  return { results: [...replays.values()] };
                },
                async run() {
                  if (sql.includes("INSERT INTO live_stream_replays")) {
                    replays.set(params[0], {
                      id: params[0],
                      event_id: params[1],
                      project_id: params[2],
                      source: "manual",
                      video_uid: null,
                      label: params[3],
                      playback_hls: params[4],
                      playback_dash: params[5],
                      thumbnail_url: params[6],
                      duration_seconds: params[7],
                      status: "ready",
                      is_primary: 1,
                      created_at: params[8],
                      ready_at: params[9],
                    });
                  }
                  if (sql.includes("SET is_primary = 0")) return { meta: { changes: 1 } };
                  if (sql.includes("SET is_primary = 1")) {
                    for (const r of replays.values()) r.is_primary = 0;
                    const row = replays.get(params[0]);
                    if (row) row.is_primary = 1;
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    },
    replays,
  };
}

describe("live-stream-replay", () => {
  it("registers manual HTTPS replay", async () => {
    const { env } = mockEnv();
    const result = await registerManualReplay(env, {
      projectId: "p1",
      eventId: "le_1",
      userId: "host",
      label: "Final broadcast",
      playbackHls: "https://cdn.example.com/replay.m3u8",
    });
    expect(result.ok).toBe(true);
    expect(result.replay?.playbackHls).toContain("https://");
    expect(result.replay?.status).toBe("ready");
  });

  it("lists replays for event", async () => {
    const { env } = mockEnv();
    await registerManualReplay(env, {
      projectId: "p1",
      eventId: "le_1",
      userId: "host",
      playbackHls: "https://cdn.example.com/a.m3u8",
    });
    const replays = await listEventReplays(env, { projectId: "p1", eventId: "le_1" });
    expect(replays.length).toBe(1);
  });

  it("returns primary ready replay", async () => {
    const { env } = mockEnv();
    await registerManualReplay(env, {
      projectId: "p1",
      eventId: "le_1",
      userId: "host",
      playbackHls: "https://cdn.example.com/primary.m3u8",
    });
    const replay = await getPrimaryEventReplay(env, { projectId: "p1", eventId: "le_1" });
    expect(replay?.isPrimary).toBe(true);
  });

  it("builds angle replay bundle with sync group", async () => {
    const replays = new Map([
      [
        "replay_a",
        {
          id: "replay_a",
          event_id: "le_1",
          project_id: "p1",
          source: "manual",
          label: "Cam A",
          playback_hls: "https://cdn.example.com/a.m3u8",
          status: "ready",
          is_primary: 1,
          angle_id: "ang_a",
          sync_group_id: "sg_le_1",
          offset_ms: 0,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      [
        "replay_b",
        {
          id: "replay_b",
          event_id: "le_1",
          project_id: "p1",
          source: "manual",
          label: "Cam B",
          playback_hls: "https://cdn.example.com/b.m3u8",
          status: "ready",
          is_primary: 0,
          angle_id: "ang_b",
          sync_group_id: "sg_le_1",
          offset_ms: 1200,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    ]);
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...params) {
              return {
                async first() {
                  if (sql.includes("is_primary DESC, ready_at DESC")) {
                    return replays.get("replay_a");
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM live_stream_replays")) {
                    return { results: [...replays.values()] };
                  }
                  if (sql.includes("FROM live_stream_angles")) {
                    return {
                      results: [
                        { id: "ang_a", label: "Main", sort_order: 0 },
                        { id: "ang_b", label: "Side", sort_order: 1 },
                      ],
                    };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };
    const bundle = await getEventReplayBundle(env, { projectId: "p1", eventId: "le_1" });
    expect(bundle.syncGroupId).toBe("sg_le_1");
    expect(bundle.angleReplays).toHaveLength(2);
    expect(bundle.angleReplays[1]?.offsetMs).toBe(1200);
  });

  it("eventSyncGroupId is stable per event", () => {
    expect(eventSyncGroupId("le_99")).toBe("sg_le_99");
  });
});
