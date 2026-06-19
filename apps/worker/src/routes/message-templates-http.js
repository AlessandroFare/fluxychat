/**
 * Message templates CRUD + render (variable substitution for outbound messages).
 *
 * GET    /templates           — list templates
 * POST   /templates           — create template { name, body }
 * GET    /templates/:id       — get template
 * PATCH  /templates/:id       — update { name?, body? }
 * DELETE /templates/:id       — delete template
 * POST   /templates/render    — render { templateId, vars }
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  isValidTemplateName,
  normalizeTemplateVars,
  renderMessageTemplate,
} from "../lib/message-template.js";

function mapMessageTemplateRow(row) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function dispatchMessageTemplatesRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
  ]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
  }

  if (url.pathname === "/templates/render" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.templateId) {
      return json({ error: "templateId required" }, { status: 400 });
    }
    const row = await env.DB.prepare(
      "SELECT body FROM message_templates WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(body.templateId, a.projectId)
      .first();
    if (!row) return json({ error: "not_found" }, { status: 404 });
    const vars = normalizeTemplateVars(body.vars) || {};
    return json({ content: renderMessageTemplate(row.body, vars) });
  }

  const installMatch = url.pathname.match(/^\/templates\/([^/]+)\/install$/);
  if (installMatch) return null;

  const idMatch = url.pathname.match(/^\/templates\/([^/]+)$/);

  if (url.pathname === "/templates" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const rows = await env.DB.prepare(
      "SELECT id, name, body, created_at, updated_at FROM message_templates WHERE project_id = ? ORDER BY updated_at DESC LIMIT 200",
    )
      .bind(a.projectId)
      .all();
    return json({
      templates: (rows.results || []).map(mapMessageTemplateRow),
    });
  }

  if (url.pathname === "/templates" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a.roles, ["owner", "admin"])) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const tplBody = typeof body?.body === "string" ? body.body : "";
    if (!name || !isValidTemplateName(name)) {
      return json({ error: "name required (alphanumeric, 1–64 chars)" }, { status: 400 });
    }
    if (!tplBody.trim()) {
      return json({ error: "body required" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(
        "INSERT INTO message_templates (id, project_id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(id, a.projectId, name, tplBody, now, now)
        .run();
    } catch (err) {
      if (String(err?.message || "").includes("UNIQUE")) {
        return json({ error: "name_already_exists" }, { status: 409 });
      }
      throw err;
    }
    return json({ template: mapMessageTemplateRow({ id, name, body: tplBody, created_at: now, updated_at: now }) });
  }

  if (idMatch && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const row = await env.DB.prepare(
      "SELECT id, name, body, created_at, updated_at FROM message_templates WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(id, a.projectId)
      .first();
    if (!row) return json({ error: "not_found" }, { status: 404 });
    return json({ template: mapMessageTemplateRow(row) });
  }

  if (idMatch && request.method === "PATCH") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a.roles, ["owner", "admin"])) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
    const id = decodeURIComponent(idMatch[1]);
    const body = await request.json().catch(() => null);
    const existing = await env.DB.prepare(
      "SELECT id, name, body FROM message_templates WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(id, a.projectId)
      .first();
    if (!existing) return json({ error: "not_found" }, { status: 404 });
    const name =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const tplBody =
      typeof body?.body === "string" ? body.body : existing.body;
    if (!isValidTemplateName(name)) {
      return json({ error: "invalid name" }, { status: 400 });
    }
    if (!String(tplBody).trim()) {
      return json({ error: "body required" }, { status: 400 });
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE message_templates SET name = ?, body = ?, updated_at = ? WHERE id = ? AND project_id = ?",
    )
      .bind(name, tplBody, now, id, a.projectId)
      .run();
    return json({
      template: mapMessageTemplateRow({
        id,
        name,
        body: tplBody,
        created_at: existing.created_at,
        updated_at: now,
      }),
    });
  }

  if (idMatch && request.method === "DELETE") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a.roles, ["owner", "admin"])) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
    const id = decodeURIComponent(idMatch[1]);
    const result = await env.DB.prepare(
      "DELETE FROM message_templates WHERE id = ? AND project_id = ?",
    )
      .bind(id, a.projectId)
      .run();
    if (!result.meta?.changes) return json({ error: "not_found" }, { status: 404 });
    return json({ ok: true });
  }

  return null;
}
