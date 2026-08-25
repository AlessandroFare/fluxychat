/**
 * Exactly-once delivery conformance test.
 *
 * Pins the three pillars behind the "exactly-once + ordered" guarantee:
 *   1. Ordering: room seq is monotonic per room/tenant
 *   2. Resume: replay(afterSeq) returns every event after that seq exactly once, in order
 *   3. Dedup contract: explicit-seq writes do not disturb the auto counter
 */
import { describe, expect, it } from "vitest";
import {
  allocateRoomMessageSeq,
  recordRoomMessageEvent,
  getRoomMessageEventsSince,
  getRoomCurrentSeq,
} from "./room-message-seq.js";

function makeEnv() {
  const seqState = new Map();
  const events = [];

  function key(projectId, roomId) {
    return `${projectId}:${roomId}`;
  }

  const DB = {
    prepare(sql) {
      return {
        bind(...binds) {
          return {
            async run() {
              if (sql.includes("INSERT INTO room_message_seq")) {
                const k = key(binds[0], binds[1]);
                seqState.set(k, (seqState.get(k) ?? 0) + 1);
                return { meta: { changes: 1 } };
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
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
            async first() {
              if (sql.includes("room_message_seq")) {
                const last = seqState.get(key(binds[0], binds[1])) ?? 0;
                return last ? { last_seq: last } : null;
              }
              return null;
            },
            async all() {
              if (sql.includes("room_message_events") && sql.includes("seq >")) {
                const projectId = binds[0];
                const roomId = binds[1];
                const afterSeq = binds[2];
                const limit = binds[3];
                const rows = events
                  .filter(
                    (e) =>
                      e.project_id === projectId &&
                      e.room_id === roomId &&
                      e.seq > afterSeq,
                  )
                  .sort((a, b) => a.seq - b.seq)
                  .slice(0, limit);
                return { results: rows };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };

  return { env: { DB }, events };
}

describe("exactly-once conformance", () => {
  it("seq allocations are strictly increasing with no gaps", async () => {
    const { env } = makeEnv();
    const seen = [];
    for (let i = 0; i < 10; i += 1) {
      seen.push(await allocateRoomMessageSeq(env, "p1", "room-a"));
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("rooms and tenants sequence independently", async () => {
    const { env } = makeEnv();
    expect(await allocateRoomMessageSeq(env, "p1", "room-a")).toBe(1);
    expect(await allocateRoomMessageSeq(env, "p1", "room-b")).toBe(1);
    expect(await allocateRoomMessageSeq(env, "p1", "room-a")).toBe(2);
    expect(await allocateRoomMessageSeq(env, "p2", "room-a")).toBe(1);
  });

  async function seedThreeEvents(env) {
    await recordRoomMessageEvent(env, { projectId: "p1", roomId: "r", messageId: 1, eventType: "create", version: 1, payload: { n: 1 } });
    await recordRoomMessageEvent(env, { projectId: "p1", roomId: "r", messageId: 2, eventType: "create", version: 1, payload: { n: 2 } });
    await recordRoomMessageEvent(env, { projectId: "p1", roomId: "r", messageId: 1, eventType: "update", version: 2, payload: { n: 3 } });
  }

  it("replay(afterSeq) returns each event exactly once, in seq order", async () => {
    const { env } = makeEnv();
    await seedThreeEvents(env);

    const fromZero = await getRoomMessageEventsSince(env, { projectId: "p1", roomId: "r", afterSeq: 0 });
    expect(fromZero.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(fromZero.lastSeq).toBe(3);

    const fromOne = await getRoomMessageEventsSince(env, { projectId: "p1", roomId: "r", afterSeq: 1 });
    expect(fromOne.events.map((e) => e.seq)).toEqual([2, 3]);
    expect(fromOne.lastSeq).toBe(3);
  });

  it("replaying the same window twice yields identical results", async () => {
    const { env } = makeEnv();
    await seedThreeEvents(env);

    const first = await getRoomMessageEventsSince(env, { projectId: "p1", roomId: "r", afterSeq: 1 });
    const second = await getRoomMessageEventsSince(env, { projectId: "p1", roomId: "r", afterSeq: 1 });
    expect(second).toEqual(first);
  });

  it("sequential replay windows across reconnects never miss or duplicate", async () => {
    const { env } = makeEnv();
    await seedThreeEvents(env);

    let cursor = 0;
    const applied = [];
    for (let round = 0; round < 3; round += 1) {
      const { events, lastSeq } = await getRoomMessageEventsSince(env, {
        projectId: "p1",
        roomId: "r",
        afterSeq: cursor,
      });
      applied.push(...events.map((e) => e.seq));
      cursor = Math.max(cursor, lastSeq);
      if (!events.length) break;
    }
    expect(applied).toEqual([1, 2, 3]);
    expect(cursor).toBe(3);
  });

  it("current seq reflects the latest allocation", async () => {
    const { env } = makeEnv();
    await seedThreeEvents(env);
    expect(await getRoomCurrentSeq(env, "p1", "r")).toBe(3);
  });

  it("payloads survive the log as structured JSON", async () => {
    const { env } = makeEnv();
    await recordRoomMessageEvent(env, {
      projectId: "p1",
      roomId: "r",
      messageId: 9,
      eventType: "create",
      version: 1,
      payload: { content: "hello", mentions: ["@bob"] },
    });
    const { events } = await getRoomMessageEventsSince(env, { projectId: "p1", roomId: "r", afterSeq: 0 });
    expect(events[0].payload).toEqual({ content: "hello", mentions: ["@bob"] });
  });

  it("explicit-seq writes do not advance the auto counter", async () => {
    const { env } = makeEnv();
    const explicit = await recordRoomMessageEvent(env, {
      projectId: "p1",
      roomId: "r",
      messageId: 5,
      eventType: "create",
      version: 1,
      payload: {},
      seq: 7,
    });
    expect(explicit.seq).toBe(7);

    const next = await allocateRoomMessageSeq(env, "p1", "r");
    expect(next).toBe(1);
  });

  it("create/update/delete each consume one fresh seq", async () => {
    const { env, events } = makeEnv();
    await recordRoomMessageEvent(env, { projectId: "p1", roomId: "r", messageId: 1, eventType: "create", version: 1, payload: {} });
    await recordRoomMessageEvent(env, { projectId: "p1", roomId: "r", messageId: 1, eventType: "update", version: 2, payload: {} });
    await recordRoomMessageEvent(env, { projectId: "p1", roomId: "r", messageId: 1, eventType: "delete", version: 3, payload: {} });
    expect(events.map((e) => e.event_type)).toEqual(["create", "update", "delete"]);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });
});
