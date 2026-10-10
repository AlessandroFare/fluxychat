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

/** JSON awareness payload on `YJS_MSG_AWARENESS` (dashboard collab + y-websocket HOW). */
export interface FluxyYjsAwarenessState {
  userId: string;
  name?: string;
  color?: string;
  cursor?: { x: number; y: number } | null;
  /** y-websocket removeAwarenessStates — drop this user. */
  left?: boolean;
}

export function encodeYjsAwareness(state: FluxyYjsAwarenessState): Uint8Array {
  return encodeYjsFrame(YJS_MSG_AWARENESS, new TextEncoder().encode(JSON.stringify(state)));
}

export function encodeYjsAwarenessLeave(userId: string): Uint8Array {
  return encodeYjsAwareness({ userId, left: true, cursor: null });
}

export function isYjsAwarenessLeave(state: FluxyYjsAwarenessState | null): boolean {
  return Boolean(state?.left);
}

export function decodeYjsAwareness(payload: Uint8Array): FluxyYjsAwarenessState | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as FluxyYjsAwarenessState;
    if (!parsed || typeof parsed.userId !== "string" || !parsed.userId.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** y-websocket treats 4400–4499 as permanent; Fluxy room WS uses 1008 for auth/protocol. */
export function isPermanentYjsClose(code: number): boolean {
  return code === 1008 || (code >= 4400 && code <= 4499);
}
