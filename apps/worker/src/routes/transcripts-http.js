import { resolveAdminContext } from "../lib/admin-route-context.js";
import { createTranscriptsApi } from "../lib/transcripts.js";

const ROLES = new Set(["user", "assistant", "system"]);
const DEFAULT_MAX_PER_USER = 200;

export async function dispatchTranscriptsRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/transcripts")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  if (request.method === "POST" && path === "/admin/transcripts") {
    const body = await request.json();
    const userKey = String(body.userKey || "").trim();
    if (!userKey) return respond({ error: "userKey_required" }, h, 400);
    if (!String(body.text || "").trim()) return respond({ error: "text_required" }, h, 400);
    const role = body.role === undefined ? "user" : String(body.role);
    if (!ROLES.has(role)) return respond({ error: "invalid_role" }, h, 400);

    const api = createTranscriptsApi(env, {
      projectId,
      maxPerUser:
        Number.isInteger(body.maxPerUser) && body.maxPerUser > 0
          ? body.maxPerUser
          : DEFAULT_MAX_PER_USER,
      retentionMs:
        Number.isFinite(body.retentionMs) && body.retentionMs > 0 ? body.retentionMs : undefined,
    });
    const entry = await api.append({
      userKey,
      role,
      text: String(body.text),
      platform: body.platform === undefined ? "unknown" : String(body.platform),
      threadId: body.threadId === undefined ? "" : String(body.threadId),
      platformMessageId: body.platformMessageId ? String(body.platformMessageId) : undefined,
    });
    return respond({ entry }, h, 201);
  }

  if (request.method === "GET" && path === "/admin/transcripts/count") {
    const userKey = String(url.searchParams.get("userKey") || "").trim();
    if (!userKey) return respond({ error: "userKey_required" }, h, 400);
    const count = await createTranscriptsApi(env, { projectId }).count({ userKey });
    return respond({ count }, h);
  }

  if (request.method === "GET" && path === "/admin/transcripts") {
    const userKey = String(url.searchParams.get("userKey") || "").trim();
    if (!userKey) return respond({ error: "userKey_required" }, h, 400);
    const platforms = csvParam(url, "platforms");
    const roles = csvParam(url, "roles");
    const limit = Number(url.searchParams.get("limit"));
    const entries = await createTranscriptsApi(env, { projectId }).list({
      userKey,
      platforms,
      roles,
      threadId: url.searchParams.get("threadId") || undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
    return respond({ entries }, h);
  }

  if (request.method === "DELETE" && path === "/admin/transcripts") {
    const userKey = String(url.searchParams.get("userKey") || "").trim();
    if (!userKey) return respond({ error: "userKey_required" }, h, 400);
    const result = await createTranscriptsApi(env, { projectId }).delete({ userKey });
    return respond(result, h);
  }

  return null;
}

function csvParam(url, name) {
  const raw = url.searchParams.get(name);
  if (!raw) return undefined;
  const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return values.length ? values : undefined;
}
