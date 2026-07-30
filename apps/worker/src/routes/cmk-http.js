import { resolveAdminContext } from "../lib/admin-route-context.js";
import { listCmkKeys, createCmkKey, rotateCmkKey, revokeCmkKey, encryptWithCmk } from "../lib/cmk-store.js";

export async function dispatchCmkRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/cmk")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/cmk/keys") {
    const keys = await listCmkKeys(env, { projectId });
    return respond({ keys }, h);
  }

  if (request.method === "POST" && path === "/admin/cmk/keys") {
    const body = await request.json().catch(() => ({}));
    const result = await createCmkKey(env, { projectId, algorithm: body.algorithm, createdBy: userId });
    return respond(result, h, 201);
  }

  const rotateMatch = path.match(/^\/admin\/cmk\/keys\/([^/]+)\/rotate$/);
  if (rotateMatch && request.method === "POST") {
    const result = await rotateCmkKey(env, { projectId, keyId: decodeURIComponent(rotateMatch[1]), performedBy: userId });
    if (result.error) return respond(result, h, 404);
    return respond(result, h);
  }

  const revokeMatch = path.match(/^\/admin\/cmk\/keys\/([^/]+)\/revoke$/);
  if (revokeMatch && request.method === "POST") {
    const result = await revokeCmkKey(env, { projectId, keyId: decodeURIComponent(revokeMatch[1]), performedBy: userId });
    if (result.error) return respond(result, h, 404);
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/cmk/encrypt") {
    const body = await request.json().catch(() => null);
    if (!body?.plaintext) return respond({ error: "plaintext required" }, h, 400);
    const result = await encryptWithCmk(env, { projectId, plaintext: body.plaintext, performedBy: userId });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  return null;
}
