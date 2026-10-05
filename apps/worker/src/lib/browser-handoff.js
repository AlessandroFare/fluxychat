/**
 * Browser Run live-view handoff into a room. Not an SFU.
 * Live View URL is only for the invoker (and optional named approvers).
 * Recording pauses during credential entry. Screenshots never land on the transcript.
 */

export const BROWSER_HANDOFF_REASONS = ["login", "mfa", "captcha", "human_required"];

export function mapBrowserHandoffRequest(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const liveViewUrl = String(body.liveViewUrl || "").trim();
  if (!liveViewUrl.startsWith("https://")) return { ok: false, error: "https_live_view_required" };
  try {
    const host = new URL(liveViewUrl).hostname;
    const allowed =
      host.endsWith(".cloudflare.com") ||
      host === "browserbase.com" ||
      host.endsWith(".browserbase.com");
    if (!allowed) return { ok: false, error: "live_view_host_not_allowed" };
  } catch {
    return { ok: false, error: "invalid_live_view_url" };
  }
  const reason = BROWSER_HANDOFF_REASONS.includes(body.reason) ? body.reason : "human_required";
  const invokerUserId = String(body.invokerUserId || "").trim().slice(0, 128);
  if (!invokerUserId) return { ok: false, error: "invoker_required" };
  const approverIds = Array.isArray(body.approverIds)
    ? body.approverIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim().slice(0, 128)).slice(0, 8)
    : [];
  return {
    ok: true,
    handoff: {
      type: "browser_handoff",
      sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null,
      liveViewUrl,
      reason,
      invokerUserId,
      approverIds,
      recordingPaused: body.recordingPaused === true || reason === "login" || reason === "mfa",
      transcriptPolicy: "no_screenshots",
      botTraffic: true,
    },
  };
}

export function canTakeBrowserHandoff(handoff, userId) {
  if (!handoff || !userId) return false;
  if (handoff.invokerUserId === userId) return true;
  return Array.isArray(handoff.approverIds) && handoff.approverIds.includes(userId);
}

export function browserHandoffRoomEvent(handoff) {
  return {
    type: "browser_handoff",
    sessionId: handoff.sessionId,
    reason: handoff.reason,
    recordingPaused: handoff.recordingPaused,
    transcriptPolicy: handoff.transcriptPolicy,
    botTraffic: true,
    visibility: "whisper",
    visibleTo: [handoff.invokerUserId, ...(handoff.approverIds || [])],
    liveViewUrl: handoff.liveViewUrl,
  };
}
