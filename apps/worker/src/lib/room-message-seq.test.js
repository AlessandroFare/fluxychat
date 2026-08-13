import { describe, expect, it } from "vitest";
import { allocateRoomMessageSeq, recordRoomMessageEvent, getRoomMessageEventsSince } from "./room-message-seq.js";

function makeEnv() {
  const seqState = new Map();
  const events = [];

  return {
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...binds) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO room_message_seq")) {
                    const key = `${binds[0]}:${binds[1]}`;
                    const next = (seqState.get(key) ?? 0) + 1;
                    seqState.set(key, next);
                  }
                  if (sql.includes("INSERT INTO room_message_events")) {
                    events.push({
                      project_id: binds[0],
                      room_id: binds[1],
                      seq: binds[2],
                      message_id: binds[3],
                      event_type: binds[4],
                      version: binds[5],
                      payload_json: binds[6],
                      created_at: binds[7],
                    });
                  }
                  return { meta: { changes: 1 } };
                },
                async first() {
                  if (sql.includes("room_message_seq")) {
                    const key = `${binds[0]}:${binds[1]}`;
                    const last = seqState.get(key) ?? 0;
                    return last ? { last_seq: last } : null;
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("room_message_events") && sql.includes("seq >")) {
                    const [projectId, roomId, afterSeq] = binds;
                    const filtered = events
                      .filter(
                        (e) =>
                          e.project_id === projectId &&
                          e.room_id === roomId &&
                          e.seq > afterSeq,
                      )
                      .sort((a, b) => a.seq - b.seq);
                    return { results: filtered };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("room-message-seq", () => {
  it("allocates monotonic seq per room", async () => {
    const { env } = makeEnv();
    const a = await allocateRoomMessageSeq(env, "p1", "r1");
    const b = await allocateRoomMessageSeq(env, "p1", "r1");
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it("records events and replays since lastSeq", async () => {
    const { env } = makeEnv();
    await recordRoomMessageEvent(env, {
      projectId: "p1",
      roomId: "r1",
      messageId: 10,
      eventType: "create",
      version: 1,
      payload: { content: "hi" },
    });
    await recordRoomMessageEvent(env, {
      projectId: "p1",
      roomId: "r1",
      messageId: 10,
      eventType: "update",
      version: 2,
      payload: { content: "hi!" },
    });

    const replay = await getRoomMessageEventsSince(env, {
      projectId: "p1",
      roomId: "r1",
      afterSeq: 1,
    });
    expect(replay.events).toHaveLength(1);
    expect(replay.events[0].eventType).toBe("update");
  });
});
