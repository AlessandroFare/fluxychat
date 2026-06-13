import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  createCase, updateCase, getCase, listCases,
  addCustodian, listCustodians,
  preserveData, listPreservations,
  collectEvidence, listEvidence,
  getChainOfCustody, getCaseStats,
} from "../lib/ediscovery.js";

export async function dispatchEdiscoveryRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/ediscovery")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/ediscovery/cases") {
    const status = url.searchParams.get("status");
    const cases = await listCases(env, { projectId, status });
    return respond({ cases }, h);
  }

  if (request.method === "POST" && path === "/admin/ediscovery/cases") {
    const body = await request.json();
    const result = await createCase(env, {
      projectId,
      caseNumber: body.caseNumber,
      title: body.title,
      description: body.description,
      matter: body.matter,
      priority: body.priority,
      assignedTo: body.assignedTo,
      createdBy: body.createdBy || userId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+$/)) {
    const id = path.split("/").pop();
    const c = await getCase(env, { id, projectId });
    if (!c) return respond({ error: "not_found" }, h, 404);
    return respond({ case: c }, h);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+$/)) {
    const id = path.split("/").pop();
    const body = await request.json();
    const result = await updateCase(env, { id, projectId, ...body });
    return respond(result, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+\/custodians$/)) {
    const caseId = path.split("/")[4];
    const body = await request.json();
    const result = await addCustodian(env, {
      caseId,
      projectId,
      userId: body.userId,
      name: body.name,
      email: body.email,
      role: body.role,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+\/custodians$/)) {
    const caseId = path.split("/")[4];
    const custodians = await listCustodians(env, { caseId });
    return respond({ custodians }, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+\/preserve$/)) {
    const caseId = path.split("/")[4];
    const body = await request.json();
    const result = await preserveData(env, {
      caseId,
      projectId,
      roomId: body.roomId,
      userId: body.userId,
      dataTypes: body.dataTypes,
      reason: body.reason,
      expiresAt: body.expiresAt,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+\/preservations$/)) {
    const caseId = path.split("/")[4];
    const preservations = await listPreservations(env, { caseId });
    return respond({ preservations }, h);
  }

  if (request.method === "POST" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+\/evidence$/)) {
    const caseId = path.split("/")[4];
    const body = await request.json();
    const result = await collectEvidence(env, {
      caseId,
      projectId,
      itemType: body.itemType,
      itemId: body.itemId,
      roomId: body.roomId,
      collectedBy: body.collectedBy || userId,
      notes: body.notes,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path.match(/^\/admin\/ediscovery\/cases\/[^/]+\/evidence$/)) {
    const caseId = path.split("/")[4];
    const itemType = url.searchParams.get("itemType");
    const evidence = await listEvidence(env, { caseId, itemType });
    return respond({ evidence }, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/ediscovery\/evidence\/[^/]+\/chain$/)) {
    const evidenceId = path.split("/")[4];
    const chain = await getChainOfCustody(env, { evidenceId });
    return respond({ chain }, h);
  }

  if (request.method === "GET" && path === "/admin/ediscovery/stats") {
    const stats = await getCaseStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
