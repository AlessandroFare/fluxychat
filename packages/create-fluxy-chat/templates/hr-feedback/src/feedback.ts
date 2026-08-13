interface FeedbackEnv {
  FLUXY_BASE_URL: string;
  FLUXY_API_KEY: string;
  HR_FEEDBACK_ROOM_ID?: string;
  HR_ESCALATION_WEBHOOK_URL?: string;
}

interface FeedbackBody {
  content?: string;
  roomId?: string;
}

export interface FeedbackResult {
  ok: boolean;
  path?: string;
  category?: string;
  confidence?: number;
  message?: string;
  error?: string;
}

/**
 * Submit anonymous feedback through the FluxyChat worker classifier.
 * Content is classified server-side; only metadata is returned.
 */
export async function submitHrFeedback(
  env: FeedbackEnv,
  body: FeedbackBody,
): Promise<FeedbackResult> {
  const content = String(body.content ?? "").trim();
  if (!content) return { ok: false, error: "content required" };
  if (content.length > 8000) return { ok: false, error: "content_too_long" };

  const baseUrl = env.FLUXY_BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/anonymous-feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.FLUXY_API_KEY}`,
    },
    body: JSON.stringify({
      content,
      roomId: body.roomId ?? env.HR_FEEDBACK_ROOM_ID ?? null,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as FeedbackResult;
  if (!res.ok) {
    return { ok: false, error: data.error ?? `worker_${res.status}` };
  }

  if (data.path === "hr_escalation" && env.HR_ESCALATION_WEBHOOK_URL) {
    await fetch(env.HR_ESCALATION_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: data.category,
        confidence: data.confidence,
        at: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }

  return {
    ok: true,
    path: data.path,
    category: data.category,
    confidence: data.confidence,
    message: data.message,
  };
}
