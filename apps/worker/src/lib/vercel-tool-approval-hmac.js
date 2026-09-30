/**
 * AI SDK 7 experimental_toolApprovalSecret HMAC.
 * Same payload as @fluxy-chat/agent signApproval: approvalId, toolCallId, toolName, SHA-256 of canonical input.
 */

function toBase64url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function canonicalJSON(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJSON(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(",")}}`;
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function hashCanonicalInput(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJSON(value ?? {})));
  return toBase64url(new Uint8Array(digest));
}

export function toolApprovalSecret(env) {
  const s = env?.TOOL_APPROVAL_SECRET || env?.ART50_MARK_SECRET || env?.JWT_SECRET || "";
  return typeof s === "string" ? s : "";
}

export async function signVercelToolApproval(secret, { approvalId, toolCallId, toolName, input }) {
  if (!secret) return null;
  const digest = await hashCanonicalInput(input);
  const payload = `${approvalId}\n${toolCallId}\n${toolName}\n${digest}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64url(new Uint8Array(mac));
}

export async function verifyVercelToolApproval(secret, { signature, approvalId, toolCallId, toolName, input }) {
  if (!secret || !signature) return false;
  const expected = await signVercelToolApproval(secret, { approvalId, toolCallId, toolName, input });
  return timingSafeEqual(expected, signature);
}
