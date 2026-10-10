/**
 * DSA notice-and-action: public report of illegal content on hosted pages.
 * Not legal advice. Hosting duties only.
 */

export function parseDsaReport(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const explanation = String(body.explanation || "").trim();
  const url = String(body.url || body.contentUrl || "").trim();
  const contact = String(body.contact || "").trim();
  const goodFaith = body.goodFaith === true || body.goodFaith === "true" || body.goodFaith === "on";
  if (explanation.length < 20) return { ok: false, error: "explanation_required" };
  if (explanation.length > 8000) return { ok: false, error: "explanation_too_long" };
  if (!/^https:\/\/[^\s]+$/i.test(url)) return { ok: false, error: "https_url_required" };
  if (contact.length < 3 || contact.length > 256) return { ok: false, error: "contact_required" };
  if (!goodFaith) return { ok: false, error: "good_faith_required" };
  let shareToken = null;
  try {
    const parsed = new URL(url);
    const m = parsed.pathname.match(/^\/share\/([a-f0-9]{48})$/i);
    if (m) shareToken = m[1].toLowerCase();
  } catch {
    return { ok: false, error: "https_url_required" };
  }
  return {
    ok: true,
    report: {
      explanation: explanation.slice(0, 8000),
      url,
      contact: contact.slice(0, 256),
      goodFaith: true,
      shareToken,
    },
  };
}

export function parseDsaClose(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const reason = String(body.restrictionReason || body.reason || "").trim();
  if (reason.length < 8) return { ok: false, error: "reason_required" };
  if (reason.length > 2000) return { ok: false, error: "reason_too_long" };
  return { ok: true, reason: reason.slice(0, 2000), status: "closed" };
}

export function dsaRestrictionEmail({ url, reason, contact }) {
  return {
    subject: "FluxyChat: notice about content you reported or posted",
    text: [
      "This is a statement of reasons under the EU Digital Services Act hosting rules, not a court order.",
      `URL: ${url}`,
      `What we did: ${reason}`,
      `Contact on the notice: ${contact}`,
      "If we disabled a share link, the token no longer resolves. Room data may still exist for the operator.",
      "Reply to support@fluxychat.com. This is not legal advice.",
    ].join("\n\n"),
  };
}

export async function disableShareToken(env, token) {
  const raw = String(token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{48}$/i.test(raw)) return { ok: false, error: "invalid_token" };
  const now = new Date().toISOString();
  if (!env?.DB) return { ok: true, disabled: false, note: "no_db" };
  const result = await env.DB.prepare(
    `UPDATE room_share_links SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL`,
  )
    .bind(now, raw)
    .run();
  return { ok: true, disabled: (result.meta?.changes || 0) > 0 };
}
