/** Room-DO Yjs frames: byte 0 is type, rest is payload (`apps/worker/src/lib/yjs-sync.js`). */

export const YJS_MSG_SYNC = 0;
export const YJS_MSG_UPDATE = 1;
export const YJS_MSG_AWARENESS = 2;

export function encodeYjsFrame(type: number, payload: Uint8Array): Uint8Array {
  const msg = new Uint8Array(1 + payload.byteLength);
  msg[0] = type;
  msg.set(payload, 1);
  return msg;
}

export function decodeYjsFrame(data: Uint8Array): { type: number; payload: Uint8Array } | null {
  if (data.byteLength < 1) return null;
  return { type: data[0] ?? 0, payload: data.slice(1) };
}
