import { logInfo } from "./worker-log.js";

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * @param {*} env
 * @param {{ to: string, subject: string, textBody: string, htmlBody?: string }} input
 */
export async function sendDigestEmail(env, input) {
  const to = String(input.to || "").trim();
  if (!isValidEmail(to)) {
    return { ok: false, skipped: true, reason: "invalid_email" };
  }

  const from =
    env.DIGEST_EMAIL_FROM?.trim() ||
    env.EMAIL_FROM?.trim() ||
    "digest@fluxychat.local";
  const subject = String(input.subject || "Your daily chat digest").slice(0, 200);
  const textBody = String(input.textBody || "").slice(0, 50_000);
  const htmlBody = input.htmlBody
    ? String(input.htmlBody).slice(0, 100_000)
    : null;

  if (typeof env.EMAIL?.send === "function") {
    try {
      await env.EMAIL.send({
        from,
        to,
        subject,
        text: textBody,
        ...(htmlBody ? { html: htmlBody } : {}),
      });
      logInfo("digest.email.sent", { to: to.replace(/(.{2}).+(@.+)/, "$1…$2") });
      return { ok: true, provider: "email_binding" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "email_send_failed" };
    }
  }

  const resendKey = env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: textBody,
        ...(htmlBody ? { html: htmlBody } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend_${res.status}`, detail: body.slice(0, 200) };
    }
    logInfo("digest.email.sent", { to: to.replace(/(.{2}).+(@.+)/, "$1…$2"), provider: "resend" });
    return { ok: true, provider: "resend" };
  }

  return { ok: false, skipped: true, reason: "email_not_configured" };
}

export { isValidEmail };
