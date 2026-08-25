/**
 * Typed internal RPC between Durable Objects (CF-A-015).
 *
 * Cloudflare Agents exposes `@callable()` on the Agent class. We keep the same
 * idea as a fetch envelope with an allowlist — never a public SDK / useAgent API.
 */

export const RPC_VERSION = 1;

export const AGENT_RPC_METHODS = {
  ping: "ping",
  state: "state",
  turn: "turn",
  schedule: "schedule",
  cancel_schedule: "cancel_schedule",
  list_schedules: "list_schedules",
  room_event: "room_event",
};

export const ROOM_RPC_METHODS = {
  ping: "ping",
  announce: "announce",
  presence: "presence",
  copilot_nudge: "copilot_nudge",
};

/**
 * @param {unknown} body
 * @param {Record<string, string>} allowlist
 * @returns {{ ok: true, method: string, params: Record<string, unknown>, id: string | null } | { ok: false, reason: string }}
 */
export function parseRpcRequest(body, allowlist) {
  if (!body || typeof body !== "object") return { ok: false, reason: "rpc_body_required" };
  const method = String(body.method || "").trim();
  if (!method) return { ok: false, reason: "rpc_method_required" };
  if (!allowlist || !Object.prototype.hasOwnProperty.call(allowlist, method)) {
    return { ok: false, reason: "rpc_method_forbidden" };
  }
  const params = body.params != null && typeof body.params === "object" && !Array.isArray(body.params)
    ? body.params
    : {};
  const id = body.id != null ? String(body.id).slice(0, 128) : null;
  return { ok: true, method, params, id, v: Number(body.v) || RPC_VERSION };
}

export function encodeRpcRequest(method, params = {}, id = null) {
  return {
    v: RPC_VERSION,
    method: String(method),
    params: params && typeof params === "object" ? params : {},
    id,
  };
}

export async function callDurableRpc(stub, method, params = {}, { path = "/rpc" } = {}) {
  if (!stub || typeof stub.fetch !== "function") {
    return { ok: false, reason: "rpc_stub_missing" };
  }
  try {
    const res = await stub.fetch(`https://internal${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(encodeRpcRequest(method, params)),
    });
    const payload = await res.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return { ok: false, reason: "invalid_rpc_response", status: res.status };
    }
    return payload;
  } catch (err) {
    return {
      ok: false,
      reason: "rpc_transport_failed",
      error: err instanceof Error ? err.message : "rpc_failed",
    };
  }
}
