/**
 * NW-113 — Portal-style recorded frame replay for WS/protocol conformance.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRAMES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "frames",
);

/**
 * @typedef {{
 *   name?: string,
 *   description?: string,
 *   frames: Array<{
 *     type: string,
 *     atMs?: number,
 *     payload: Record<string, unknown>,
 *   }>,
 *   expect?: {
 *     messageCount?: number,
 *     eventTypes?: string[],
 *     finalOnline?: number,
 *   },
 * }} FrameRecording
 */

/**
 * @param {string} name Fixture basename without .json
 * @returns {FrameRecording}
 */
export function loadFrameRecording(name) {
  const filePath = join(FRAMES_DIR, `${name}.json`);
  const raw = readFileSync(filePath, "utf8");
  const doc = JSON.parse(raw);
  if (!Array.isArray(doc.frames)) {
    throw new Error(`frame recording ${name}: frames[] required`);
  }
  return {
    name: doc.name || name,
    description: doc.description || "",
    frames: doc.frames,
    expect: doc.expect || {},
  };
}

/** @returns {string[]} */
export function listFrameRecordings() {
  if (!existsSync(FRAMES_DIR)) return [];
  return readdirSync(FRAMES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/**
 * Apply a recorded frame stream to an in-memory room state reducer.
 *
 * @param {FrameRecording} recording
 * @param {{
 *   onFrame?: (frame: FrameRecording['frames'][number], state: FrameReplayState) => void,
 * }} [opts]
 */
export function replayFrameRecording(recording, opts = {}) {
  /** @type {FrameReplayState} */
  const state = {
    messages: [],
    reactions: {},
    online: 0,
    users: [],
    eventTypes: [],
    errors: [],
  };

  for (const frame of recording.frames) {
    state.eventTypes.push(frame.type);
    try {
      applyFrame(frame, state);
      opts.onFrame?.(frame, state);
    } catch (err) {
      state.errors.push({
        type: frame.type,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return state;
}

/**
 * @typedef {{
 *   messages: Array<Record<string, unknown>>,
 *   reactions: Record<string, Record<string, number>>,
 *   online: number,
 *   users: string[],
 *   eventTypes: string[],
 *   errors: Array<{ type: string, error: string }>,
 * }} FrameReplayState
 */

/**
 * @param {FrameRecording['frames'][number]} frame
 * @param {FrameReplayState} state
 */
function applyFrame(frame, state) {
  const p = frame.payload || {};
  switch (frame.type) {
    case "history":
    case "replay": {
      const msgs = Array.isArray(p.messages) ? p.messages : [];
      for (const m of msgs) upsertMessage(state, m);
      if (p.reactions && typeof p.reactions === "object") {
        state.reactions = { ...state.reactions, ...p.reactions };
      }
      break;
    }
    case "message":
      upsertMessage(state, p);
      break;
    case "presence":
      state.online = Number(p.online ?? p.users?.length ?? 0);
      if (Array.isArray(p.users)) state.users = [...p.users];
      break;
    case "reaction": {
      const mid = String(p.messageId ?? "");
      const emoji = String(p.emoji ?? "");
      if (!mid || !emoji) break;
      if (!state.reactions[mid]) state.reactions[mid] = {};
      const op = p.op === "remove" ? -1 : 1;
      state.reactions[mid][emoji] = Math.max(
        0,
        (state.reactions[mid][emoji] || 0) + op,
      );
      break;
    }
    case "typing":
    case "subscription_succeeded":
    case "agentTyping":
    case "agentRun":
      break;
    default:
      // Unknown frames are recorded but not fatal
      break;
  }
}

/**
 * @param {FrameReplayState} state
 * @param {Record<string, unknown>} msg
 */
function upsertMessage(state, msg) {
  const id = msg.id;
  if (id == null) {
    state.messages.push(msg);
    return;
  }
  const idx = state.messages.findIndex((m) => m.id === id);
  if (idx >= 0) state.messages[idx] = { ...state.messages[idx], ...msg };
  else state.messages.push(msg);
}

/**
 * @param {FrameRecording} recording
 * @param {FrameReplayState} state
 */
export function assertFrameExpectations(recording, state) {
  const expect = recording.expect || {};
  if (expect.messageCount !== undefined && state.messages.length !== expect.messageCount) {
    throw new Error(
      `recording ${recording.name}: expected ${expect.messageCount} messages, got ${state.messages.length}`,
    );
  }
  if (expect.finalOnline !== undefined && state.online !== expect.finalOnline) {
    throw new Error(
      `recording ${recording.name}: expected online=${expect.finalOnline}, got ${state.online}`,
    );
  }
  if (Array.isArray(expect.eventTypes)) {
    for (const t of expect.eventTypes) {
      if (!state.eventTypes.includes(t)) {
        throw new Error(`recording ${recording.name}: missing event type ${t}`);
      }
    }
  }
  if (state.errors.length) {
    throw new Error(
      `recording ${recording.name}: frame errors ${JSON.stringify(state.errors)}`,
    );
  }
  return true;
}

export { FRAMES_DIR };
