/**
 * Yjs binary transport through RoomDurableObject.onMessage/onClose —
 * the wire between `/ws/room/:id` sockets and `apps/worker/src/lib/yjs-sync.js`.
 * Lib-level round-trips live in `src/lib/yjs-sync.test.js`; these tests pin the
 * DO wiring (storage persistence, broadcast exclusion, awareness leave).
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { RoomDurableObject } from "./room-do.js";

const roomId = "room_do_yjs";

function createRoomDo() {
  const storageMap = new Map();
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              run: async () => ({ meta: {} }),
              first: async () => null,
              all: async () => ({ results: [] }),
            };
          },
        };
      },
    },
    RATE_LIMIT_WS_MESSAGES_PER_MINUTE: "60",
    OG_PREVIEW_ENABLED: "false",
  };
  const state = {
    id: { toString: () => roomId },
    storage: {
      get: async (key) => storageMap.get(key),
      put: async (key, value) => {
        storageMap.set(key, value);
      },
      delete: async (key) => storageMap.delete(key),
    },
  };
  const roomDo = new RoomDurableObject(state, env);
  roomDo.projectId = "proj_yjs";
  roomDo.roomId = roomId;
  return { roomDo, storageMap };
}

function createBinaryWebSocket() {
  const sent = [];
  return {
    sent,
    binary: () => sent.filter((data) => data instanceof Uint8Array),
    accept() {},
    addEventListener() {},
    send(data) {
      sent.push(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    },
  };
}

function yjsFrame(type, payload = new Uint8Array(0)) {
  const frame = new Uint8Array(1 + payload.byteLength);
  frame[0] = type;
  frame.set(payload, 1);
  return frame;
}

function updateFrame(setKey, value) {
  const doc = new Y.Doc();
  doc.getMap("shared").set(setKey, value);
  return yjsFrame(1, Y.encodeStateAsUpdate(doc));
}

describe("RoomDurableObject Yjs binary transport", () => {
  it("relays a type-1 update to peers, not the sender, and persists to DO storage", async () => {
    const { roomDo, storageMap } = createRoomDo();
    const sender = createBinaryWebSocket();
    const peer = createBinaryWebSocket();
    roomDo.clients.add(sender);
    roomDo.clients.add(peer);

    const frame = updateFrame("k", "v");
    await roomDo.onMessage(sender, { data: frame.buffer });

    expect(sender.binary()).toHaveLength(0);
    const relayed = peer.binary();
    expect(relayed).toHaveLength(1);
    expect(Array.from(relayed[0])).toEqual(Array.from(frame));

    const persisted = storageMap.get(`yjs_doc_state:${roomId}`);
    expect(persisted).toBeTruthy();
    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(persisted));
    expect(restored.getMap("shared").get("k")).toBe("v");
  });

  it("announces collab activity as a server_event on the first update", async () => {
    const { roomDo } = createRoomDo();
    const sender = createBinaryWebSocket();
    roomDo.clients.add(sender);

    await roomDo.onMessage(sender, { data: updateFrame("k", "v").buffer });

    const events = sender.sent
      .filter((data) => typeof data === "string")
      .map((data) => JSON.parse(data))
      .filter((msg) => msg.type === "server_event");
    expect(events[0]).toMatchObject({
      name: "collab.crdt_update",
      roomId,
      data: { channel: "yjs" },
    });
  });

  it("answers a type-0 full sync with the merged document state", async () => {
    const { roomDo } = createRoomDo();
    const client = createBinaryWebSocket();
    const other = createBinaryWebSocket();
    roomDo.clients.add(client);
    roomDo.clients.add(other);

    await roomDo.onMessage(other, { data: updateFrame("shared_key", 42).buffer });
    client.sent.length = 0;
    await roomDo.onMessage(client, { data: yjsFrame(0).buffer });

    const replies = client.binary();
    expect(replies).toHaveLength(1);
    expect(replies[0][0]).toBe(0);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, replies[0].slice(1));
    expect(doc.getMap("shared").get("shared_key")).toBe(42);
  });

  it("fans out type-2 awareness frames to peers without echoing the sender", async () => {
    const { roomDo } = createRoomDo();
    const sender = createBinaryWebSocket();
    const peer = createBinaryWebSocket();
    roomDo.clients.add(sender);
    roomDo.clients.add(peer);

    const payload = new TextEncoder().encode(
      JSON.stringify({ userId: "u1", name: "Ada", color: "#6366f1" }),
    );
    await roomDo.onMessage(sender, { data: yjsFrame(2, payload).buffer });

    expect(sender.binary()).toHaveLength(0);
    const relayed = peer.binary();
    expect(relayed).toHaveLength(1);
    expect(relayed[0][0]).toBe(2);
    expect(JSON.parse(new TextDecoder().decode(relayed[0].slice(1)))).toMatchObject({
      userId: "u1",
      name: "Ada",
    });
  });

  it("rejects binary frames on a readonly socket", async () => {
    const { roomDo } = createRoomDo();
    const ws = createBinaryWebSocket();
    roomDo.clients.add(ws);
    roomDo.sessions.write(ws, { u: "user_ro", ro: 1 });

    await roomDo.onMessage(ws, { data: yjsFrame(0).buffer });

    expect(JSON.parse(ws.sent[0])).toMatchObject({
      type: "error",
      message: "readonly_connection",
    });
    expect(ws.binary()).toHaveLength(0);
  });

  it("broadcasts an awareness leave frame when the socket drops", async () => {
    const { roomDo } = createRoomDo();
    const dropper = createBinaryWebSocket();
    const peer = createBinaryWebSocket();
    roomDo.clients.add(dropper);
    roomDo.clients.add(peer);

    await roomDo.onMessage(dropper, {
      data: yjsFrame(
        2,
        new TextEncoder().encode(JSON.stringify({ userId: "u7", name: "Drop" })),
      ).buffer,
    });
    peer.sent.length = 0;

    roomDo.onClose(dropper);

    const frames = peer.binary();
    expect(frames).toHaveLength(1);
    expect(frames[0][0]).toBe(2);
    expect(JSON.parse(new TextDecoder().decode(frames[0].slice(1)))).toEqual({
      userId: "u7",
      left: true,
    });
  });

  it("ignores empty and unknown frame types without sending anything", async () => {
    const { roomDo } = createRoomDo();
    const a = createBinaryWebSocket();
    const b = createBinaryWebSocket();
    roomDo.clients.add(a);
    roomDo.clients.add(b);

    await roomDo.onMessage(a, { data: new Uint8Array(0).buffer });
    await roomDo.onMessage(a, { data: new Uint8Array([9, 1, 2]).buffer });

    expect(a.sent).toHaveLength(0);
    expect(b.sent).toHaveLength(0);
  });
});
