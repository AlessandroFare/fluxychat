/**
 * P18 Enterprise Compliance HTTP routes.
 *
 * Classification:  GET/POST /enterprise/classification/labels, PATCH/DELETE /enterprise/classification/labels/:id
 *                   POST /enterprise/classification/rooms/:roomId, GET /enterprise/classification/rooms/:roomId
 *                   POST /enterprise/classification/messages/:messageId, GET /enterprise/classification/messages/:messageId
 * Retention:       GET/POST /enterprise/retention/policies, PATCH/DELETE /enterprise/retention/policies/:id
 * Legal Holds:     POST /enterprise/retention/holds, POST /enterprise/retention/holds/:id/release
 *                   GET /enterprise/retention/holds?roomId=X
 * Export Snapshots: GET/POST /enterprise/retention/exports
 * DLP:             GET/POST /enterprise/dlp/rules, PATCH/DELETE /enterprise/dlp/rules/:id
 *                   POST /enterprise/dlp/scan
 * AI Policy:       GET/POST /enterprise/ai-policies, PATCH/DELETE /enterprise/ai-policies/:id
 *                   POST /enterprise/ai-policies/check
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  listLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  classifyRoom,
  classifyMessage,
  getRoomClassification,
  getMessageClassifications,
} from "../lib/data-classification.js";
import {
  listRetentionPolicies,
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  createLegalHold,
  releaseLegalHold,
  getActiveHoldsForRoom,
  isRoomOnHold,
  createExportSnapshot,
  updateExportSnapshotStatus,
  listExportSnapshots,
} from "../lib/retention-legal-hold.js";
import {
  createDlpRule,
  listDlpRules,
  updateDlpRule,
  deleteDlpRule,
  scanContent,
  redactText,
  logDlpResult,
} from "../lib/dlp-redaction.js";
import {
  createPolicy,
  listPolicies,
  updatePolicy,
  deletePolicy,
  checkPolicy,
  logViolation,
  getViolationStats,
} from "../lib/ai-action-policy.js";

export async function dispatchEnterpriseComplianceRoutes(request, url, h) {
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

  /* ══════════════════════════════════════════════
     Classification Labels
     ══════════════════════════════════════════════ */

  // GET /enterprise/classification/labels
  if (url.pathname === "/enterprise/classification/labels" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const labels = await listLabels(env, { projectId: auth.projectId });
    return json({ labels, count: labels.length });
  }

  // POST /enterprise/classification/labels
  if (url.pathname === "/enterprise/classification/labels" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name is required" }, { status: 400 });
    const label = await createLabel(env, {
      projectId: auth.projectId,
      name: body.name,
      level: body.level,
      color: body.color,
      description: body.description,
    });
    return json(label, { status: 201 });
  }

  // PATCH /enterprise/classification/labels/:id
  const labelPatchMatch = url.pathname.match(/^\/enterprise\/classification\/labels\/([^/]+)$/);
  if (labelPatchMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const labelId = decodeURIComponent(labelPatchMatch[1]);
    const body = await request.json().catch(() => null);
    const updated = await updateLabel(env, { projectId: auth.projectId, labelId, ...body });
    if (!updated) return json({ error: "not_found" }, { status: 404 });
    return json(updated);
  }

  // DELETE /enterprise/classification/labels/:id
  const labelDeleteMatch = url.pathname.match(/^\/enterprise\/classification\/labels\/([^/]+)$/);
  if (labelDeleteMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const labelId = decodeURIComponent(labelDeleteMatch[1]);
    const result = await deleteLabel(env, { projectId: auth.projectId, labelId });
    if (!result.ok) return json({ error: result.error }, { status: 404 });
    return json({ ok: true });
  }

  /* ══════════════════════════════════════════════
     Room / Message Classification
     ══════════════════════════════════════════════ */

  // POST /enterprise/classification/rooms/:roomId
  const roomClassPostMatch = url.pathname.match(/^\/enterprise\/classification\/rooms\/([^/]+)$/);
  if (roomClassPostMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomClassPostMatch[1]);
    const body = await request.json().catch(() => null);
    if (!body?.labelId) return json({ error: "labelId is required" }, { status: 400 });
    const result = await classifyRoom(env, {
      projectId: auth.projectId,
      roomId,
      labelId: body.labelId,
      classifiedBy: auth.userId,
    });
    if (!result.ok) return json({ error: result.error }, { status: 400 });
    return json(result, { status: 201 });
  }

  // GET /enterprise/classification/rooms/:roomId
  const roomClassGetMatch = url.pathname.match(/^\/enterprise\/classification\/rooms\/([^/]+)$/);
  if (roomClassGetMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomClassGetMatch[1]);
    const classification = await getRoomClassification(env, { projectId: auth.projectId, roomId });
    return json({ classification });
  }

  // POST /enterprise/classification/messages/:messageId
  const msgClassPostMatch = url.pathname.match(/^\/enterprise\/classification\/messages\/([^/]+)$/);
  if (msgClassPostMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const messageId = decodeURIComponent(msgClassPostMatch[1]);
    const body = await request.json().catch(() => null);
    if (!body?.labelId) return json({ error: "labelId is required" }, { status: 400 });
    const result = await classifyMessage(env, {
      projectId: auth.projectId,
      messageId,
      labelId: body.labelId,
      classifiedBy: auth.userId,
    });
    if (!result.ok) return json({ error: result.error }, { status: 400 });
    return json(result, { status: 201 });
  }

  // GET /enterprise/classification/messages/:messageId
  const msgClassGetMatch = url.pathname.match(/^\/enterprise\/classification\/messages\/([^/]+)$/);
  if (msgClassGetMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const messageId = decodeURIComponent(msgClassGetMatch[1]);
    const classifications = await getMessageClassifications(env, { projectId: auth.projectId, messageId });
    return json({ classifications });
  }

  /* ══════════════════════════════════════════════
     Retention Policies
     ══════════════════════════════════════════════ */

  // GET /enterprise/retention/policies
  if (url.pathname === "/enterprise/retention/policies" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policies = await listRetentionPolicies(env, { projectId: auth.projectId });
    return json({ policies, count: policies.length });
  }

  // POST /enterprise/retention/policies
  if (url.pathname === "/enterprise/retention/policies" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name is required" }, { status: 400 });
    const policy = await createRetentionPolicy(env, {
      projectId: auth.projectId,
      name: body.name,
      roomId: body.roomId,
      retentionDays: body.retentionDays,
      autoDelete: body.autoDelete,
      requireApproval: body.requireApproval,
    });
    return json(policy, { status: 201 });
  }

  // PATCH /enterprise/retention/policies/:id
  const retPatchMatch = url.pathname.match(/^\/enterprise\/retention\/policies\/([^/]+)$/);
  if (retPatchMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policyId = decodeURIComponent(retPatchMatch[1]);
    const body = await request.json().catch(() => null);
    const updated = await updateRetentionPolicy(env, { projectId: auth.projectId, policyId, ...body });
    if (!updated) return json({ error: "not_found" }, { status: 404 });
    return json(updated);
  }

  // DELETE /enterprise/retention/policies/:id
  const retDeleteMatch = url.pathname.match(/^\/enterprise\/retention\/policies\/([^/]+)$/);
  if (retDeleteMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policyId = decodeURIComponent(retDeleteMatch[1]);
    const result = await deleteRetentionPolicy(env, { projectId: auth.projectId, policyId });
    if (!result.ok) return json({ error: result.error }, { status: 404 });
    return json({ ok: true });
  }

  /* ══════════════════════════════════════════════
     Legal Holds
     ══════════════════════════════════════════════ */

  // GET /enterprise/retention/holds?roomId=X
  if (url.pathname === "/enterprise/retention/holds" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = url.searchParams.get("roomId");
    if (!roomId) return json({ error: "roomId query param is required" }, { status: 400 });
    const holds = await getActiveHoldsForRoom(env, { projectId: auth.projectId, roomId });
    return json({ holds, count: holds.length });
  }

  // POST /enterprise/retention/holds
  if (url.pathname === "/enterprise/retention/holds" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.reason) return json({ error: "reason is required" }, { status: 400 });
    const hold = await createLegalHold(env, {
      projectId: auth.projectId,
      roomId: body.roomId,
      reason: body.reason,
      placedBy: auth.userId,
      expiresAt: body.expiresAt,
    });
    return json(hold, { status: 201 });
  }

  // POST /enterprise/retention/holds/:id/release
  const holdReleaseMatch = url.pathname.match(/^\/enterprise\/retention\/holds\/([^/]+)\/release$/);
  if (holdReleaseMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const holdId = decodeURIComponent(holdReleaseMatch[1]);
    const result = await releaseLegalHold(env, { projectId: auth.projectId, holdId });
    if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
    return json(result);
  }

  /* ══════════════════════════════════════════════
     Export Snapshots
     ══════════════════════════════════════════════ */

  // GET /enterprise/retention/exports
  if (url.pathname === "/enterprise/retention/exports" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const snapshots = await listExportSnapshots(env, { projectId: auth.projectId });
    return json({ snapshots, count: snapshots.length });
  }

  // POST /enterprise/retention/exports
  if (url.pathname === "/enterprise/retention/exports" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const snapshot = await createExportSnapshot(env, {
      projectId: auth.projectId,
      roomId: body?.roomId,
      format: body?.format,
      filterJson: body?.filterJson,
      requestedBy: auth.userId,
    });
    return json(snapshot, { status: 201 });
  }

  /* ══════════════════════════════════════════════
     DLP Rules
     ══════════════════════════════════════════════ */

  // GET /enterprise/dlp/rules
  if (url.pathname === "/enterprise/dlp/rules" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const rules = await listDlpRules(env, { projectId: auth.projectId });
    return json({ rules, count: rules.length });
  }

  // POST /enterprise/dlp/rules
  if (url.pathname === "/enterprise/dlp/rules" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.pattern) return json({ error: "name and pattern are required" }, { status: 400 });
    const rule = await createDlpRule(env, {
      projectId: auth.projectId,
      name: body.name,
      ruleType: body.ruleType,
      pattern: body.pattern,
      action: body.action,
      severity: body.severity,
    });
    return json(rule, { status: 201 });
  }

  // PATCH /enterprise/dlp/rules/:id
  const dlpPatchMatch = url.pathname.match(/^\/enterprise\/dlp\/rules\/([^/]+)$/);
  if (dlpPatchMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ruleId = decodeURIComponent(dlpPatchMatch[1]);
    const body = await request.json().catch(() => null);
    const updated = await updateDlpRule(env, { projectId: auth.projectId, ruleId, ...body });
    if (!updated) return json({ error: "not_found" }, { status: 404 });
    return json(updated);
  }

  // DELETE /enterprise/dlp/rules/:id
  const dlpDeleteMatch = url.pathname.match(/^\/enterprise\/dlp\/rules\/([^/]+)$/);
  if (dlpDeleteMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ruleId = decodeURIComponent(dlpDeleteMatch[1]);
    const result = await deleteDlpRule(env, { projectId: auth.projectId, ruleId });
    if (!result.ok) return json({ error: result.error }, { status: 404 });
    return json({ ok: true });
  }

  // POST /enterprise/dlp/scan
  if (url.pathname === "/enterprise/dlp/scan" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.text) return json({ error: "text is required" }, { status: 400 });
    const matches = await scanContent(env, { projectId: auth.projectId, text: body.text });
    const redacted = matches.length > 0 ? redactText(body.text, matches) : body.text;

    // Log results if message/room context provided
    if (body.messageId || body.roomId) {
      await logDlpResult(env, {
        projectId: auth.projectId,
        messageId: body.messageId,
        roomId: body.roomId,
        matches,
      });
    }

    return json({
      matches,
      matchCount: matches.length,
      originalText: body.text,
      redactedText: redacted,
    });
  }

  /* ══════════════════════════════════════════════
     AI Action Policies
     ══════════════════════════════════════════════ */

  // GET /enterprise/ai-policies
  if (url.pathname === "/enterprise/ai-policies" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policies = await listPolicies(env, { projectId: auth.projectId });
    return json({ policies, count: policies.length });
  }

  // POST /enterprise/ai-policies
  if (url.pathname === "/enterprise/ai-policies" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.actionType) return json({ error: "name and actionType are required" }, { status: 400 });
    const policy = await createPolicy(env, {
      projectId: auth.projectId,
      name: body.name,
      actionType: body.actionType,
      toolName: body.toolName,
      allowed: body.allowed,
      requireApproval: body.requireApproval,
      maxExecutionsPerHour: body.maxExecutionsPerHour,
      allowedUserRoles: body.allowedUserRoles,
      conditions: body.conditions,
    });
    return json(policy, { status: 201 });
  }

  // PATCH /enterprise/ai-policies/:id
  const aiPatchMatch = url.pathname.match(/^\/enterprise\/ai-policies\/([^/]+)$/);
  if (aiPatchMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policyId = decodeURIComponent(aiPatchMatch[1]);
    const body = await request.json().catch(() => null);
    const updated = await updatePolicy(env, { projectId: auth.projectId, policyId, ...body });
    if (!updated) return json({ error: "not_found" }, { status: 404 });
    return json(updated);
  }

  // DELETE /enterprise/ai-policies/:id
  const aiDeleteMatch = url.pathname.match(/^\/enterprise\/ai-policies\/([^/]+)$/);
  if (aiDeleteMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const policyId = decodeURIComponent(aiDeleteMatch[1]);
    const result = await deletePolicy(env, { projectId: auth.projectId, policyId });
    if (!result.ok) return json({ error: result.error }, { status: 404 });
    return json({ ok: true });
  }

  // POST /enterprise/ai-policies/check
  if (url.pathname === "/enterprise/ai-policies/check" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.actionType) return json({ error: "actionType is required" }, { status: 400 });
    const result = await checkPolicy(env, {
      projectId: auth.projectId,
      actionType: body.actionType,
      toolName: body.toolName,
      userRoles: body.userRoles || auth.roles,
      agentId: body.agentId,
    });
    return json(result);
  }

  // GET /enterprise/ai-policies/violations
  if (url.pathname === "/enterprise/ai-policies/violations" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getViolationStats(env, { projectId: auth.projectId });
    return json(stats);
  }

  return null;
}
