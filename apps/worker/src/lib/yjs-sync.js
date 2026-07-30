import * as Y from "yjs";

const STORAGE_KEY = "yjs_doc_state";

export class YjsSyncHandler {
  constructor() {
    /** @type {Map<string, Y.Doc>} */
    this.docs = new Map();
    /** @type {Map<string, Map<WebSocket, { userId: string, ts: number }>>} */
    this.awarenessByRoom = new Map();
    /** @type {Map<string, number>} */
    this.lastServerEventAt = new Map();
  }

  /** @param {string} roomId @param {import("@cloudflare/workers-types").DurableObjectStorage} storage */
  async getDoc(roomId, storage) {
    if (this.docs.has(roomId)) return this.docs.get(roomId);
    const doc = new Y.Doc();
    try {
      const persisted = await storage.get(`${STORAGE_KEY}:${roomId}`);
      if (persisted instanceof ArrayBuffer || persisted instanceof Uint8Array) {
        Y.applyUpdate(doc, new Uint8Array(persisted), "load");
      }
    } catch { /* first time */ }
    doc.on("update", (update, origin) => {
      if (origin === "load") return;
      const state = Y.encodeStateAsUpdate(doc);
      storage.put(`${STORAGE_KEY}:${roomId}`, state.buffer).catch(() => {});
    });
    this.docs.set(roomId, doc);
    return doc;
  }

  /**
   * Protocol:
   *   byte 0: type (0=fullSync, 1=update, 2=awareness)
   *   bytes 1+: payload
   */
  async handleBinary(data, senderWs, roomId, storage, broadcastFn, options = {}) {
    if (data.byteLength < 1) return;
    const type = data[0];
    const payload = data.slice(1);
    const onActivity = typeof options.onActivity === "function" ? options.onActivity : null;

    if (type === 0) {
      await this._handleFullSync(payload, senderWs, roomId, storage);
    } else if (type === 1) {
      await this._handleUpdate(payload, senderWs, roomId, storage, broadcastFn, data, onActivity);
    } else if (type === 2) {
      this._handleAwareness(payload, senderWs, roomId, broadcastFn, onActivity);
    }
  }

  async _handleFullSync(payload, senderWs, roomId, storage) {
    const doc = await this.getDoc(roomId, storage);
    if (payload.byteLength > 0) {
      Y.applyUpdate(doc, payload, "load");
    }
    const fullState = Y.encodeStateAsUpdate(doc);
    const response = new Uint8Array(1 + fullState.byteLength);
    response[0] = 0;
    response.set(fullState, 1);
    try { senderWs.send(response.buffer); } catch { /* ignore */ }
  }

  _maybeAnnounceActivity(onActivity, roomId, name, byteLength, senderWs) {
    if (!onActivity) return;
    const key = `${roomId}:${name}`;
    const now = Date.now();
    const last = this.lastServerEventAt.get(key) || 0;
    if (now - last < 400) return;
    this.lastServerEventAt.set(key, now);
    onActivity({ roomId, name, byteLength, senderWs });
  }

  async _handleUpdate(payload, senderWs, roomId, storage, broadcastFn, rawData, onActivity) {
    if (payload.byteLength === 0) return;
    const doc = await this.getDoc(roomId, storage);
    Y.applyUpdate(doc, payload);
    broadcastFn(new Uint8Array(rawData), senderWs);
    this._maybeAnnounceActivity(onActivity, roomId, "collab.crdt_update", payload.byteLength, senderWs);
  }

  _handleAwareness(payload, senderWs, roomId, broadcastFn, onActivity) {
    if (!this.awarenessByRoom.has(roomId)) {
      this.awarenessByRoom.set(roomId, new Map());
    }
    const roomAw = this.awarenessByRoom.get(roomId);
    roomAw.set(senderWs, { userId: `user:${Date.now()}`, ts: Date.now() });
    broadcastFn(new Uint8Array([2, ...payload]), senderWs);
    this._maybeAnnounceActivity(onActivity, roomId, "collab.awareness", payload.byteLength, senderWs);
  }

  removeClient(ws, roomId) {
    const roomAw = this.awarenessByRoom.get(roomId);
    if (roomAw) roomAw.delete(ws);
  }
}
