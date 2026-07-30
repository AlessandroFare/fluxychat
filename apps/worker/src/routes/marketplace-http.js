import { depsEnv } from "../lib/deps-env.js";
import { resolveMemberContext } from "../lib/admin-route-context.js";
import { rolesInclude } from "../lib/route-jwt-auth.js";
import { pickRouteDeps } from "./route-http-deps.js";
import {
  publishAgent, updateAgent, submitForReview, reviewAgent,
  getAgent, getAgentBySlug, listAgents, listPublisherAgents,
  installAgent, uninstallAgent, listInstalledAgents,
  addReview, listReviews, getMarketplaceStats,
} from "../lib/agent-marketplace.js";

export async function dispatchMarketplaceRoutes(request, url, h) {
  const path = url.pathname;
  const env = depsEnv(h);
  const { json: respond, hasAnyRole } = pickRouteDeps(h, ["json", "hasAnyRole"]);

  if (request.method === "GET" && path === "/marketplace/agents") {
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const sort = url.searchParams.get("sort");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const agents = await listAgents(env, { category, status: "published", search, sort, limit, offset });
    return respond({ agents }, h);
  }

  if (request.method === "GET" && path.match(/^\/marketplace\/agents\/[^/]+$/)) {
    const slug = path.split("/").pop();
    const agent = await getAgentBySlug(env, { slug });
    if (!agent) return respond({ error: "not_found" }, h, 404);
    return respond({ agent }, h);
  }

  if (request.method === "GET" && path === "/marketplace/stats") {
    const stats = await getMarketplaceStats(env);
    return respond({ stats }, h);
  }

  if (!path.startsWith("/admin/marketplace")) return null;

  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { projectId, userId } = ctx;
  const isAdmin = rolesInclude(ctx.auth, hasAnyRole, ["owner", "admin"]);

  if (request.method === "GET" && path === "/admin/marketplace/agents") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const agents = await listPublisherAgents(env, { publisherId: userId, status, limit, offset });
    return respond({ agents }, h);
  }

  if (request.method === "POST" && path === "/admin/marketplace/agents") {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const body = await request.json();
    const result = await publishAgent(env, {
      publisherId: userId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      longDescription: body.longDescription,
      category: body.category,
      iconUrl: body.iconUrl,
      configTemplate: body.configTemplate,
      systemPrompt: body.systemPrompt,
      tools: body.tools,
      integrations: body.integrations,
      pricing: body.pricing,
      pricingConfig: body.pricingConfig,
      version: body.version,
      tags: body.tags,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/marketplace\/agents\/[^/]+$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await updateAgent(env, { id, publisherId: userId, ...body });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/marketplace\/agents\/[^/]+\/submit$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const id = path.split("/")[4];
    const result = await submitForReview(env, { id, publisherId: userId });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/marketplace\/agents\/[^/]+\/review$/)) {
    if (!isAdmin) return respond({ error: "forbidden" }, h, 403);
    const id = path.split("/")[4];
    const body = await request.json();
    const result = await reviewAgent(env, { id, status: body.status });
    if (result.error) return respond(result, h, 400);
    return respond(result, h);
  }

  if (request.method === "POST" && path === "/admin/marketplace/install") {
    const body = await request.json();
    const result = await installAgent(env, {
      agentId: body.agentId,
      projectId,
      installedBy: body.installedBy || userId,
      configOverride: body.configOverride,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "DELETE" && path === "/admin/marketplace/install") {
    const agentId = url.searchParams.get("agentId");
    const result = await uninstallAgent(env, { agentId, projectId });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/marketplace/installed") {
    const agents = await listInstalledAgents(env, { projectId });
    return respond({ agents }, h);
  }

  if (request.method === "POST" && path === "/admin/marketplace/reviews") {
    const body = await request.json();
    const result = await addReview(env, {
      agentId: body.agentId,
      projectId,
      userId: body.userId || userId,
      rating: body.rating,
      title: body.title,
      body: body.body,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/marketplace/reviews") {
    const agentId = url.searchParams.get("agentId");
    const reviews = await listReviews(env, { agentId });
    return respond({ reviews }, h);
  }

  return null;
}
