import { pickRouteDeps } from "./route-http-deps.js";
import {
  renderMarkdown,
  extractMarkdownFeatures,
  getLinkPreview,
  purgeExpiredPreviews,
  detectFileType,
  generateRichPreview,
} from "../lib/rich-previews.js";

export async function dispatchRichPreviewsRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError",
  ]);

  const linkPreviewMatch = url.pathname === "/previews/link";
  const renderMatch = url.pathname === "/previews/render";
  const analyzeMatch = url.pathname === "/previews/analyze";
  const fileTypeMatch = url.pathname === "/previews/file-type";
  const purgeMatch = url.pathname === "/admin/previews/purge";

  if (!linkPreviewMatch && !renderMatch && !analyzeMatch && !fileTypeMatch && !purgeMatch) {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    /* ── POST /previews/link ── */
    if (linkPreviewMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const linkUrl = body?.url;
      if (!linkUrl) return json({ error: "url_required" }, { status: 400, headers: corsHeaders });

      const preview = await getLinkPreview(env, { projectId: auth.projectId, url: linkUrl });
      if (!preview) return json({ ok: true, preview: null }, { headers: corsHeaders });
      return json({ ok: true, preview }, { headers: corsHeaders });
    }

    /* ── POST /previews/render ── */
    if (renderMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const content = body?.content || "";
      if (!content) return json({ ok: true, html: "", features: extractMarkdownFeatures("") }, { headers: corsHeaders });

      const html = renderMarkdown(content);
      const features = extractMarkdownFeatures(content);
      return json({ ok: true, html, features }, { headers: corsHeaders });
    }

    /* ── POST /previews/analyze ── */
    if (analyzeMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const content = body?.content || "";
      const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
      const preview = generateRichPreview({ content, attachments });
      return json({ ok: true, preview }, { headers: corsHeaders });
    }

    /* ── POST /previews/file-type ── */
    if (fileTypeMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = detectFileType({
        filename: body?.filename,
        mimeType: body?.mimeType,
        size: body?.size,
      });
      return json({ ok: true, ...result }, { headers: corsHeaders });
    }

    /* ── POST /admin/previews/purge ── */
    if (purgeMatch && request.method === "POST") {
      if (!auth.roles?.includes("admin")) {
        return json({ error: "admin_required" }, { status: 403, headers: corsHeaders });
      }
      const result = await purgeExpiredPreviews(env);
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("rich_previews.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
