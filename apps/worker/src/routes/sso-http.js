import { json } from "../lib/http-json.js";
import * as SSO from "../lib/sso-saml.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchSSORoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/sso")) return null;

  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;

  if (path === "/api/sso/configurations" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await SSO.createConfiguration(env, body);
    return json(result);
  }

  if (path === "/api/sso/configurations" && request.method === "GET") {
    const result = await SSO.listConfigurations(env, { projectId, status: url.searchParams.get("status") });
    return json(result);
  }

  if (path.match(/^\/api\/sso\/configurations\/[a-z0-9]+$/) && request.method === "GET") {
    const configId = path.split("/").pop();
    const result = await SSO.getConfiguration(env, { configId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/sso\/configurations\/[a-z0-9]+$/) && request.method === "PATCH") {
    const configId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await SSO.updateConfiguration(env, { configId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/sso\/configurations\/[a-z0-9]+$/) && request.method === "DELETE") {
    const configId = path.split("/").pop();
    const result = await SSO.deleteConfiguration(env, { configId });
    return json(result);
  }

  if (path === "/api/sso/sessions" && request.method === "GET") {
    const result = await SSO.listSessions(env, {
      projectId, userId: url.searchParams.get("userId"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/sso\/sessions\/[a-z0-9]+$/) && request.method === "GET") {
    const sessionId = path.split("/").pop();
    const result = await SSO.getSession(env, { sessionId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/sso\/sessions\/[a-z0-9]+\/touch$/) && request.method === "POST") {
    const sessionId = path.split("/")[4];
    const result = await SSO.touchSession(env, { sessionId });
    return json(result);
  }

  if (path.match(/^\/api\/sso\/sessions\/[a-z0-9]+\/invalidate$/) && request.method === "POST") {
    const sessionId = path.split("/")[4];
    const result = await SSO.invalidateSession(env, { sessionId });
    return json(result);
  }

  if (path === "/api/sso/sessions/invalidate-all" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await SSO.invalidateUserSessions(env, body);
    return json(result);
  }

  if (path === "/api/sso/jit" && request.method === "GET") {
    const result = await SSO.listProvisionedUsers(env, {
      projectId, limit: parseInt(url.searchParams.get("limit") || "50"),
    });
    return json(result);
  }

  if (path === "/api/sso/audit" && request.method === "GET") {
    const result = await SSO.listAuditLog(env, {
      projectId, eventType: url.searchParams.get("eventType"), userId: url.searchParams.get("userId"),
      limit: parseInt(url.searchParams.get("limit") || "50"),
    });
    return json(result);
  }

  if (path === "/api/sso/stats" && request.method === "GET") {
    const result = await SSO.getSSOStats(env, { projectId });
    return json(result);
  }

  return null;
}
