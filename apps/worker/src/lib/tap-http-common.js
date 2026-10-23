/**
 * Shared HTML/response helpers for the one-tap approval pages: HITL tool
 * approvals (/public/hitl/tap) and ops run approvals (/public/ops/approvals/tap).
 * Kept dumb on purpose: no state, no crypto - the callers own token verification.
 */

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlPage(title, bodyInner) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    ${bodyInner}
  </body>
</html>`;
}

export function tapResponse({ wantsJson, json, corsHeaders, status, ok, error, message, htmlInner }) {
  if (wantsJson) {
    return json({ ok, error: error || undefined, message }, { status, headers: corsHeaders });
  }
  return new Response(htmlPage(ok ? "Approval" : "Approval failed", htmlInner || `<p>${escapeHtml(message)}</p>`), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function readTapToken(request, url) {
  const fromQuery = url.searchParams.get("token") || "";
  if (request.method === "GET") return fromQuery;
  const ctype = String(request.headers.get("content-type") || "");
  if (ctype.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return String(body?.token || fromQuery);
  }
  if (ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    return String(form?.get("token") || fromQuery);
  }
  const text = await request.text().catch(() => "");
  if (text.includes("=")) {
    const params = new URLSearchParams(text);
    return params.get("token") || fromQuery;
  }
  return fromQuery;
}
