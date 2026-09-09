const SFU_API = "https://rtc.live.cloudflare.com/v1";
export const HUDDLE_MAX_PARTICIPANTS = 16;

export function isRealtimeSfuConfigured(env) {
  return Boolean(String(env?.REALTIME_SFU_APP_ID || "").trim() && String(env?.REALTIME_SFU_APP_SECRET || "").trim());
}

export function defaultHuddleProvider(env, provider) {
  if (provider) return String(provider);
  if (isRealtimeSfuConfigured(env)) return "cloudflare-realtime";
  return "livekit";
}

export function huddleParticipantCap(max) {
  const n = Number(max);
  if (!Number.isFinite(n)) return 8;
  return Math.min(Math.max(Math.floor(n), 2), HUDDLE_MAX_PARTICIPANTS);
}

export async function realtimeSfuRequest(env, method, path, body) {
  if (!isRealtimeSfuConfigured(env)) {
    return { ok: false, error: "realtime_sfu_not_configured", status: 503 };
  }
  const appId = encodeURIComponent(String(env.REALTIME_SFU_APP_ID).trim());
  const res = await fetch(`${SFU_API}/apps/${appId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${String(env.REALTIME_SFU_APP_SECRET).trim()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: "sfu_upstream", status: res.status, details: data };
  }
  return { ok: true, data };
}

export function createRealtimeSfuSession(env, payload) {
  return realtimeSfuRequest(env, "POST", "/sessions/new", payload);
}

export function addRealtimeSfuTracks(env, sessionId, payload) {
  return realtimeSfuRequest(
    env,
    "POST",
    `/sessions/${encodeURIComponent(sessionId)}/tracks/new`,
    payload ?? {},
  );
}

export function renegotiateRealtimeSfuSession(env, sessionId, payload) {
  return realtimeSfuRequest(
    env,
    "PUT",
    `/sessions/${encodeURIComponent(sessionId)}/renegotiate`,
    payload ?? {},
  );
}
