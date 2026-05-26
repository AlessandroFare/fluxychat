import { pickRouteDeps } from "./route-http-deps.js";
import {
  isValidTemplateName,
  renderMessageTemplate,
} from "../lib/message-template.js";

function newTemplateId() {
  return `tpl_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function mapTemplateRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Message templates CRUD (project-scoped, admin JWT).
 * @returns {Promise<Response|null>}
 */
export async function dispatchTemplatesRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "isValidId",
  ]);

  if (!url.pathname.startsWith("/templates")) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  if (!hasAnyRole(auth.roles, ["admin", "owner"])) {
    return json({ error: "forbidden" }, { status: 403 });
  }

  const { projectId: authProjectId } = auth;

  if (url.pathname === "/templates" && request.method === "GET") {
    const rows =
      (
        await env.DB.prepare(
          `SELECT id, project_id, name, body, created_at, updated_at
           FROM message_templates
           WHERE project_id = ?
           ORDER BY updated_at DESC
           LIMIT 200`
        )
          .bind(authProjectId)
          .all()
      ).results || [];
    return json({ templates: rows.map(mapTemplateRow) });
  }

  if (url.pathname === "/templates/render" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const templateId = typeof body?.templateId === "string" ? body.templateId.trim() : "";
    const templateBody = typeof body?.body === "string" ? body.body : "";
    const vars = body?.vars ?? body?.templateVars ?? {};
    if (templateId) {
      const row = await env.DB.prepare(
        `SELECT body FROM message_templates WHERE id = ? AND project_id = ?`
      )
        .bind(templateId, authProjectId)
        .first();
      if (!row) return json({ error: "template_not_found" }, { status: 404 });
      return json({ content: renderMessageTemplate(row.body, vars) });
    }
    return json({ content: renderMessageTemplate(templateBody, vars) });
  }

  if (url.pathname === "/templates" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const templateBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!isValidTemplateName(name)) {
      return json({ error: "invalid_template_name" }, { status: 400 });
    }
    if (!templateBody || templateBody.length > 8000) {
      return json({ error: "invalid_template_body" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const id = newTemplateId();
    try {
      await env.DB.prepare(
        `INSERT INTO message_templates (id, project_id, name, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(id, authProjectId, name, templateBody, now, now)
        .run();
    } catch (err) {
      if (String(err?.message || "").includes("UNIQUE")) {
        return json({ error: "template_name_exists" }, { status: 409 });
      }
      throw err;
    }
    return json({
      template: {
        id,
        projectId: authProjectId,
        name,
        body: templateBody,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "templates" && parts.length === 2 && isValidId(parts[1])) {
    const templateId = parts[1];

    if (request.method === "GET") {
      const row = await env.DB.prepare(
        `SELECT id, project_id, name, body, created_at, updated_at
         FROM message_templates WHERE id = ? AND project_id = ?`
      )
        .bind(templateId, authProjectId)
        .first();
      if (!row) return json({ error: "not_found" }, { status: 404 });
      return json({ template: mapTemplateRow(row) });
    }

    if (request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const row = await env.DB.prepare(
        `SELECT id, name, body, created_at FROM message_templates WHERE id = ? AND project_id = ?`
      )
        .bind(templateId, authProjectId)
        .first();
      if (!row) return json({ error: "not_found" }, { status: 404 });
      const name =
        typeof body?.name === "string" ? body.name.trim() : row.name;
      const templateBody =
        typeof body?.body === "string" ? body.body.trim() : row.body;
      if (!isValidTemplateName(name)) {
        return json({ error: "invalid_template_name" }, { status: 400 });
      }
      if (!templateBody || templateBody.length > 8000) {
        return json({ error: "invalid_template_body" }, { status: 400 });
      }
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE message_templates SET name = ?, body = ?, updated_at = ? WHERE id = ? AND project_id = ?`
      )
        .bind(name, templateBody, updatedAt, templateId, authProjectId)
        .run();
      return json({
        template: {
          id: templateId,
          projectId: authProjectId,
          name,
          body: templateBody,
          createdAt: row.created_at,
          updatedAt,
        },
      });
    }

    if (request.method === "DELETE") {
      await env.DB.prepare(
        `DELETE FROM message_templates WHERE id = ? AND project_id = ?`
      )
        .bind(templateId, authProjectId)
        .run();
      return json({ ok: true });
    }
  }

  return null;
}

export { renderMessageTemplate };
