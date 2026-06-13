/**
 * P20-B: Realtime Approval Workflows HTTP Routes.
 *
 * Workflows: POST/GET /enterprise/approvals/workflows, GET/DELETE /enterprise/approvals/workflows/:id
 * Requests:  POST /enterprise/approvals/requests, GET/DELETE /enterprise/approvals/requests/:id
 * Votes:     POST /enterprise/approvals/requests/:id/vote, GET /enterprise/approvals/requests/:id/votes
 * Stats:     GET /enterprise/approvals/stats/:roomId
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createWorkflow, getWorkflow, listWorkflows, deleteWorkflow,
  createRequest, getRequest, listRequests, cancelRequest,
  castVote, getVotesForRequest, getApprovalStats,
} from "../lib/approval-workflows.js";

export async function dispatchApprovalRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return null;
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }

  async function anyAuth() {
    return verifyJwtAndGetContext(request, env).catch(() => null);
  }

  /* Workflows */
  if (url.pathname === "/enterprise/approvals/workflows" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.roomId) return json({ error: "name and roomId required" }, { status: 400 });
    const wf = await createWorkflow(env, {
      projectId: auth.projectId, roomId: body.roomId, name: body.name,
      description: body.description, workflowType: body.workflowType,
      requiredApprovals: body.requiredApprovals, requiredRoles: body.requiredRoles,
      slaMinutes: body.slaMinutes, autoApproveAfterSla: body.autoApproveAfterSla,
      notifyOnRequest: body.notifyOnRequest, notifyOnDecision: body.notifyOnDecision,
    });
    return json(wf, { status: 201 });
  }

  if (url.pathname === "/enterprise/approvals/workflows" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const wfs = await listWorkflows(env, { projectId: auth.projectId, roomId: params.roomId });
    return json({ workflows: wfs, count: wfs.length });
  }

  const wfMatch = url.pathname.match(/^\/enterprise\/approvals\/workflows\/([^/]+)$/);
  if (wfMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const wf = await getWorkflow(env, { projectId: auth.projectId, workflowId: decodeURIComponent(wfMatch[1]) });
    if (!wf) return json({ error: "not_found" }, { status: 404 });
    return json(wf);
  }

  if (wfMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const deleted = await deleteWorkflow(env, { projectId: auth.projectId, workflowId: decodeURIComponent(wfMatch[1]) });
    return json({ deleted });
  }

  /* Requests */
  if (url.pathname === "/enterprise/approvals/requests" && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.workflowId || !body?.title) return json({ error: "workflowId and title required" }, { status: 400 });
    const req = await createRequest(env, {
      projectId: auth.projectId, workflowId: body.workflowId, roomId: body.roomId,
      requesterId: auth.userId, title: body.title, description: body.description,
      contextType: body.contextType, contextId: body.contextId,
      contextData: body.contextData, slaMinutes: body.slaMinutes,
    });
    return json(req, { status: 201 });
  }

  if (url.pathname === "/enterprise/approvals/requests" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const reqs = await listRequests(env, {
      projectId: auth.projectId, roomId: params.roomId, status: params.status,
      limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ requests: reqs, count: reqs.length });
  }

  const reqMatch = url.pathname.match(/^\/enterprise\/approvals\/requests\/([^/]+)$/);
  if (reqMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const req = await getRequest(env, { projectId: auth.projectId, requestId: decodeURIComponent(reqMatch[1]) });
    if (!req) return json({ error: "not_found" }, { status: 404 });
    return json(req);
  }

  if (reqMatch && request.method === "DELETE") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await cancelRequest(env, { projectId: auth.projectId, requestId: decodeURIComponent(reqMatch[1]) });
    return json({ ok });
  }

  const voteMatch = url.pathname.match(/^\/enterprise\/approvals\/requests\/([^/]+)\/vote$/);
  if (voteMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.vote) return json({ error: "vote required (approve/reject/abstain)" }, { status: 400 });
    const result = await castVote(env, {
      projectId: auth.projectId, requestId: decodeURIComponent(voteMatch[1]),
      voterId: auth.userId, vote: body.vote, comment: body.comment,
    });
    return json(result, { status: 201 });
  }

  const votesMatch = url.pathname.match(/^\/enterprise\/approvals\/requests\/([^/]+)\/votes$/);
  if (votesMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const votes = await getVotesForRequest(env, {
      projectId: auth.projectId, requestId: decodeURIComponent(votesMatch[1]),
    });
    return json({ votes, count: votes.length });
  }

  const statsMatch = url.pathname.match(/^\/enterprise\/approvals\/stats\/([^/]+)$/);
  if (statsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getApprovalStats(env, {
      projectId: auth.projectId, roomId: decodeURIComponent(statsMatch[1]),
    });
    return json(stats);
  }

  return null;
}
