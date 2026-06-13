import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAdminContext } from "../lib/admin-route-context.js";
import * as HIPAA from "../lib/hipaa-compliance.js";

export async function dispatchHIPAARoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/hipaa/")) return null;

  const { json } = pickRouteDeps(h, ["json"]);
  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId } = ctx;

  if (path === "/api/hipaa/baa" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.createBAA(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/hipaa/baa" && request.method === "GET") {
    const result = await HIPAA.listBAAs(env, { projectId, status: url.searchParams.get("status") });
    return json(result);
  }

  if (path.match(/^\/api\/hipaa\/baa\/[a-z0-9]+$/) && request.method === "PATCH") {
    const baaId = path.split("/").pop();
    const body = await request.json();
    const result = await HIPAA.updateBAA(env, { baaId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/hipaa/phi/access" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.logPHIAccess(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/hipaa/phi/access" && request.method === "GET") {
    const result = await HIPAA.listPHIAccessLogs(env, {
      projectId,
      userId: url.searchParams.get("userId"),
      phiType: url.searchParams.get("phiType"),
      limit: parseInt(url.searchParams.get("limit") || "50", 10),
    });
    return json(result);
  }

  if (path === "/api/hipaa/phi/detections" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.logPHIDetection(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/hipaa/phi/detections" && request.method === "GET") {
    const result = await HIPAA.listPHIDetections(env, {
      projectId,
      roomId: url.searchParams.get("roomId"),
      detectedType: url.searchParams.get("detectedType"),
      actionTaken: url.searchParams.get("actionTaken"),
      limit: parseInt(url.searchParams.get("limit") || "50", 10),
    });
    return json(result);
  }

  if (path.match(/^\/api\/hipaa\/phi\/detections\/[a-z0-9]+\/review$/) && request.method === "POST") {
    const detectionId = path.split("/")[5];
    const body = await request.json();
    const result = await HIPAA.reviewPHIDetection(env, { detectionId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/hipaa/breaches" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.createBreach(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/hipaa/breaches" && request.method === "GET") {
    const result = await HIPAA.listBreaches(env, {
      projectId,
      status: url.searchParams.get("status"),
      severity: url.searchParams.get("severity"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/hipaa\/breaches\/[a-z0-9]+$/) && request.method === "PATCH") {
    const breachId = path.split("/").pop();
    const body = await request.json();
    const result = await HIPAA.updateBreach(env, { breachId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/hipaa/training" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.assignTraining(env, { ...body, projectId });
    return json(result);
  }

  if (path.match(/^\/api\/hipaa\/training\/[a-z0-9]+\/complete$/) && request.method === "POST") {
    const trainingId = path.split("/")[4];
    const body = await request.json();
    const result = await HIPAA.completeTraining(env, { trainingId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/hipaa/training" && request.method === "GET") {
    const result = await HIPAA.listTrainings(env, {
      projectId,
      userId: url.searchParams.get("userId"),
      status: url.searchParams.get("status"),
    });
    return json(result);
  }

  if (path === "/api/hipaa/encryption" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.configureEncryption(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/hipaa/encryption" && request.method === "GET") {
    const result = await HIPAA.listEncryptionConfigs(env, { projectId });
    return json(result);
  }

  if (path === "/api/hipaa/audit" && request.method === "POST") {
    const body = await request.json();
    const result = await HIPAA.logAuditEvent(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/hipaa/audit" && request.method === "GET") {
    const result = await HIPAA.listAuditLogs(env, {
      projectId,
      eventType: url.searchParams.get("eventType"),
      userId: url.searchParams.get("userId"),
      limit: parseInt(url.searchParams.get("limit") || "50", 10),
    });
    return json(result);
  }

  if (path === "/api/hipaa/dashboard" && request.method === "GET") {
    const result = await HIPAA.getHIPAADashboard(env, { projectId });
    return json(result);
  }

  return null;
}
