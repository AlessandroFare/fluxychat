import { AGENT_RPC_METHODS, ROOM_RPC_METHODS, callDurableRpc } from "./do-rpc.js";

export const AGENT_DO_TURNS_KEY = "agent-do:turns:v1";
export const AGENT_DO_META_KEY = "agent-do:meta:v1";
export const MAX_COPILOT_TURNS = 200;

export function agentDoName(projectId, agentId, userId) {
  return `${String(projectId || "").trim()}__${String(agentId || "").trim()}__${String(userId || "").trim()}`;
}

export function copilotThreadId(agentId, userId) {
  return `copilot:${String(agentId || "").trim()}:${String(userId || "").trim()}`;
}

export function getAgentStub(env, { projectId, agentId, userId }) {
  if (!env?.AGENT || typeof env.AGENT.idFromName !== "function") return null;
  const name = agentDoName(projectId, agentId, userId);
  if (name.includes("____") || name.startsWith("__") || name.endsWith("__")) return null;
  return env.AGENT.get(env.AGENT.idFromName(name));
}

/**
 * Internal callable-style RPC over DO fetch. Not a public SDK surface.
 */
export async function callAgentDo(env, ids, method, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(AGENT_RPC_METHODS, method)) {
    return { ok: false, reason: "rpc_method_forbidden" };
  }
  const stub = getAgentStub(env, ids);
  if (!stub) return { ok: false, reason: "agent_do_unbound" };
  return callDurableRpc(stub, method, params);
}

export function getCanonicalRoomStub(env, roomId) {
  if (!env?.ROOM || typeof env.ROOM.idFromName !== "function") return null;
  const id = String(roomId || "").trim();
  if (!id) return null;
  return env.ROOM.get(env.ROOM.idFromName(id));
}

export async function callRoomDo(env, roomId, method, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(ROOM_RPC_METHODS, method)) {
    return { ok: false, reason: "rpc_method_forbidden" };
  }
  const stub = getCanonicalRoomStub(env, roomId);
  if (!stub) return { ok: false, reason: "room_do_unbound" };
  return callDurableRpc(stub, method, params);
}

export function appendCopilotTurn(turns, turn, now = Date.now()) {
  const list = Array.isArray(turns) ? turns : [];
  list.push({
    id: turn.id || `turn_${now}_${list.length}`,
    role: turn.role === "assistant" ? "assistant" : "user",
    content: String(turn.content || "").slice(0, 8000),
    runId: turn.runId || null,
    at: Number(turn.at) || now,
  });
  if (list.length > MAX_COPILOT_TURNS) list.splice(0, list.length - MAX_COPILOT_TURNS);
  return list;
}

export function serializeCopilotState({ meta, turns }) {
  return {
    projectId: meta?.projectId || null,
    agentId: meta?.agentId || null,
    userId: meta?.userId || null,
    threadId: meta?.threadId || null,
    turnCount: Array.isArray(turns) ? turns.length : 0,
    turns: Array.isArray(turns) ? turns : [],
    lastRunId: meta?.lastRunId || null,
    updatedAt: meta?.updatedAt || null,
  };
}

export async function loadCopilotState(storage) {
  if (!storage?.get) return { meta: {}, turns: [] };
  const [meta, turns] = await Promise.all([
    storage.get(AGENT_DO_META_KEY),
    storage.get(AGENT_DO_TURNS_KEY),
  ]);
  return {
    meta: meta && typeof meta === "object" ? meta : {},
    turns: Array.isArray(turns) ? turns : [],
  };
}

export async function saveCopilotState(storage, { meta, turns }) {
  if (!storage?.put) return;
  await storage.put(AGENT_DO_META_KEY, meta || {});
  await storage.put(AGENT_DO_TURNS_KEY, Array.isArray(turns) ? turns : []);
}
