import { resolveMemberContext } from "../lib/admin-route-context.js";
import { rolesInclude } from "../lib/route-jwt-auth.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createWorkspace, getWorkspace, updateWorkspace,
  addTab, removeTab, listTabs,
  pinItem, unpinItem, listPins,
  createTemplate, listTemplates, applyTemplate, getWorkspaceStats,
} from "../lib/ai-workspace.js";

export async function dispatchWorkspaceRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/workspace")) return null;

  const { hasAnyRole } = pickRouteDeps(h, ["hasAnyRole"]);
  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;
  const isAdmin = rolesInclude(ctx.auth, hasAnyRole, ["owner", "admin"]);

  if (request.method === "GET" && path === "/admin/workspace/templates") {
    const templates = await listTemplates(env, { projectId });
    return respond({ templates }, h);
  }

  if (request.method === "POST" && path === "/admin/workspace/templates") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await createTemplate(env, {
      projectId,
      name: body.name,
      description: body.description,
      tabs: body.tabs,
      agentConfig: body.agentConfig,
      settings: body.settings,
      isSystem: body.isSystem,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/workspace/apply-template") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await applyTemplate(env, {
      templateId: body.templateId,
      projectId,
      roomId: body.roomId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/workspace") {
    const roomId = url.searchParams.get("roomId");
    if (!roomId) return respond({ error: "roomId is required" }, h, 400);
    const workspace = await getWorkspace(env, { projectId, roomId });
    if (!workspace) return respond({ error: "not_found" }, h, 404);
    return respond({ workspace }, h);
  }

  if (request.method === "POST" && path === "/admin/workspace") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await createWorkspace(env, {
      projectId,
      roomId: body.roomId,
      name: body.name,
      description: body.description,
      tabs: body.tabs,
      agentId: body.agentId,
      knowledgeScope: body.knowledgeScope,
      settings: body.settings,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "PATCH" && path === "/admin/workspace") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await updateWorkspace(env, {
      id: body.id,
      projectId,
      name: body.name,
      description: body.description,
      agentId: body.agentId,
      knowledgeScope: body.knowledgeScope,
      settings: body.settings,
    });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/workspace/tabs") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await addTab(env, {
      workspaceId: body.workspaceId,
      tabType: body.tabType,
      label: body.label,
      icon: body.icon,
      sortOrder: body.sortOrder,
      config: body.config,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/workspace\/tabs\/[^/]+$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const id = path.split("/").pop();
    const result = await removeTab(env, { id });
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/workspace/pins") {
    const body = await request.json();
    const result = await pinItem(env, {
      workspaceId: body.workspaceId,
      itemType: body.itemType,
      itemId: body.itemId,
      pinnedBy: body.pinnedBy || userId,
      note: body.note,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/workspace\/pins\/[^/]+$/)) {
    const id = path.split("/").pop();
    const result = await unpinItem(env, { id });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/workspace/stats") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const stats = await getWorkspaceStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
