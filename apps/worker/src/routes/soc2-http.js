import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAdminContext } from "../lib/admin-route-context.js";
import * as SOC2 from "../lib/soc2-compliance.js";

export async function dispatchSOC2Routes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/soc2/")) return null;

  const { json } = pickRouteDeps(h, ["json"]);
  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId } = ctx;

  if (path === "/api/soc2/controls" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.createControl(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/controls" && request.method === "GET") {
    const result = await SOC2.listControls(env, {
      projectId,
      trustService: url.searchParams.get("trustService"),
      status: url.searchParams.get("status"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/soc2\/controls\/[a-z0-9]+$/) && request.method === "GET") {
    const controlDbId = path.split("/").pop();
    const result = await SOC2.getControl(env, { controlDbId, projectId });
    return result ? json(result) : json({ error: "not_found" }, { status: 404 });
  }

  if (path.match(/^\/api\/soc2\/controls\/[a-z0-9]+$/) && request.method === "PATCH") {
    const controlDbId = path.split("/").pop();
    const body = await request.json();
    const result = await SOC2.updateControl(env, { controlDbId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/soc2/evidence" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.addEvidence(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/evidence" && request.method === "GET") {
    const result = await SOC2.listEvidence(env, {
      projectId,
      controlId: url.searchParams.get("controlId"),
    });
    return json(result);
  }

  if (path === "/api/soc2/risks" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.createRiskAssessment(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/risks" && request.method === "GET") {
    const result = await SOC2.listRiskAssessments(env, {
      projectId,
      status: url.searchParams.get("status"),
      riskLevel: url.searchParams.get("riskLevel"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/soc2\/risks\/[a-z0-9]+$/) && request.method === "PATCH") {
    const riskId = path.split("/").pop();
    const body = await request.json();
    const result = await SOC2.updateRiskAssessment(env, { riskId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/soc2/policies" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.createPolicy(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/policies" && request.method === "GET") {
    const result = await SOC2.listPolicies(env, {
      projectId,
      policyType: url.searchParams.get("policyType"),
      status: url.searchParams.get("status"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/soc2\/policies\/[a-z0-9]+$/) && request.method === "PATCH") {
    const policyId = path.split("/").pop();
    const body = await request.json();
    const result = await SOC2.updatePolicy(env, { policyId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/soc2/policies/acknowledge" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.acknowledgePolicy(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/policies/acknowledgments" && request.method === "GET") {
    const result = await SOC2.listPolicyAcknowledgments(env, {
      projectId,
      policyId: url.searchParams.get("policyId"),
    });
    return json(result);
  }

  if (path === "/api/soc2/incidents" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.createIncident(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/incidents" && request.method === "GET") {
    const result = await SOC2.listIncidents(env, {
      projectId,
      status: url.searchParams.get("status"),
      severity: url.searchParams.get("severity"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/soc2\/incidents\/[a-z0-9]+$/) && request.method === "PATCH") {
    const incidentId = path.split("/").pop();
    const body = await request.json();
    const result = await SOC2.updateIncident(env, { incidentId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/soc2/reports" && request.method === "POST") {
    const body = await request.json();
    const result = await SOC2.createReport(env, { ...body, projectId });
    return json(result);
  }

  if (path === "/api/soc2/reports" && request.method === "GET") {
    const result = await SOC2.listReports(env, {
      projectId,
      reportType: url.searchParams.get("reportType"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/soc2\/reports\/[a-z0-9]+$/) && request.method === "PATCH") {
    const reportId = path.split("/").pop();
    const body = await request.json();
    const result = await SOC2.updateReport(env, { reportId, projectId, ...body });
    return json(result);
  }

  if (path === "/api/soc2/dashboard" && request.method === "GET") {
    const result = await SOC2.getComplianceDashboard(env, { projectId });
    return json(result);
  }

  if (path === "/api/soc2/self-assessment" && request.method === "GET") {
    const { buildSoc2SelfAssessment } = await import("../lib/soc2-readiness-checklist.js");
    const result = await buildSoc2SelfAssessment(env, projectId);
    return json(result);
  }

  return null;
}
