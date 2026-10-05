/**
 * Browser Run live view into a room. Whisper-only; invoker or named approvers.
 */

export async function postBrowserHandoff(opts: {
  workerUrl: string;
  token: string;
  roomId: string;
  liveViewUrl: string;
  reason?: "login" | "mfa" | "captcha" | "human_required";
  approverIds?: string[];
  sessionId?: string;
}): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(
    `${opts.workerUrl.replace(/\/$/, "")}/rooms/${encodeURIComponent(opts.roomId)}/browser-handoff`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        liveViewUrl: opts.liveViewUrl,
        reason: opts.reason,
        approverIds: opts.approverIds,
        sessionId: opts.sessionId,
      }),
    },
  );
  return { ok: res.ok, status: res.status };
}
