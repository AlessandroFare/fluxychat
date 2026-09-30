/**
 * Documented input for OPA/Rego or @ai-sdk/policy-opa.
 * Worker posts this JSON to agentPolicy.opaUrl when set (HTTPS only).
 */
export const AGENT_POLICY_OPA_INPUT_VERSION = 1;

export function buildAgentPolicyOpaInput({
  toolName,
  arguments: args,
  roomId,
  requesterUserId,
  trust = "untrusted",
  estimatedCostUsd = null,
  agentId = null,
  projectId = null,
}) {
  return {
    v: AGENT_POLICY_OPA_INPUT_VERSION,
    tool: String(toolName || "").slice(0, 128),
    arguments: args && typeof args === "object" ? args : {},
    room: { id: roomId || null },
    requester: { userId: requesterUserId || null },
    trust: trust === "trusted" ? "trusted" : "untrusted",
    cost: { estimatedUsd: typeof estimatedCostUsd === "number" ? estimatedCostUsd : null },
    agentId: agentId || null,
    projectId: projectId || null,
  };
}

export function isSafeOpaUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || ""));
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  if (host === "::1" || host.startsWith("[::1]")) return false;
  if (/^(127|10)\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false;
  return true;
}

/**
 * POST `{ input }` to opaUrl. Expects `{ allow: boolean }` or `{ result: { allow } }`.
 * Fail closed on network/parse errors.
 */
export async function evaluateAgentPolicyOpa(opaUrl, input, fetchImpl = fetch) {
  if (!isSafeOpaUrl(opaUrl)) return { allow: false, error: "unsafe_opa_url" };
  const res = await fetchImpl(opaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  }).catch(() => null);
  if (!res || !res.ok) return { allow: false, error: "opa_unreachable" };
  const body = await res.json().catch(() => null);
  const allow = body?.allow === true || body?.result?.allow === true;
  return { allow, raw: body };
}
