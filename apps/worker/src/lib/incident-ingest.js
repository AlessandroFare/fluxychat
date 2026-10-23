/**
 * P20-A bridge: incident-class provider webhooks (integration kit) drive the
 * incident lifecycle and can trigger ambient agents via `webhook` policies.
 * Severity mapping is conservative: unknown → sev3.
 */
import {
  addIncidentUpdate,
  createIncident,
  ingestAlert,
  linkAlertToIncident,
  updateIncident,
} from "./incident-response.js";

export const INCIDENT_PROVIDERS = new Set(["pagerduty", "incidentio", "sentry"]);

/** Lifecycle phases that can start a configured workflow. */
export const INCIDENT_PHASES = new Set(["created", "acknowledged", "resolved"]);

function lower(v) {
  return String(v || "").trim().toLowerCase();
}

function incidentObject(provider, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (provider === "pagerduty") return p.event?.data || {};
  if (provider === "incidentio") return p.incident || p.public_incident || {};
  if (provider === "sentry") return p.data?.issue || {};
  return {};
}

/**
 * Provider event → incident phase. Returns null for events that are not part
 * of the incident lifecycle (they stay a plain room event).
 * @returns {"open"|"acknowledged"|"resolved"|"update"|null}
 */
export function classifyProviderIncidentEvent(provider, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (provider === "pagerduty") {
    const type = lower(p.event?.event_type || p.event_type);
    if (type === "incident.triggered") return "open";
    if (type === "incident.acknowledged") return "acknowledged";
    if (type === "incident.resolved") return "resolved";
    if (type.startsWith("incident.")) return "update";
    return null;
  }
  if (provider === "incidentio") {
    const type = lower(p.event_type || p.type);
    if (type.endsWith("incident_created_v2") || type === "incident_created") return "open";
    const status = lower(incidentObject(provider, p).status || incidentObject(provider, p).status_category);
    if (status.includes("resolved") || status.includes("closed")) return "resolved";
    if (type.includes("incident")) return "update";
    return null;
  }
  if (provider === "sentry") {
    const action = lower(p.action);
    if (action === "created") return "open";
    if (action === "resolved") return "resolved";
    if (action) return "update";
    return null;
  }
  return null;
}

export function incidentSeverityFor(provider, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (provider === "pagerduty") {
    const priority = lower(p.event?.data?.priority?.name || p.priority?.name);
    if (/critical|sev1|^p1$|p0/.test(priority)) return "sev1";
    const urgency = lower(p.event?.data?.urgency || p.urgency);
    if (urgency === "high") return "sev2";
    if (urgency === "low") return "sev3";
    return "sev3";
  }
  if (provider === "incidentio") {
    const sev = lower(incidentObject(provider, p).severity?.name || p.severity?.name);
    if (sev.includes("critical")) return "sev1";
    if (sev.includes("major") || sev.includes("serious")) return "sev2";
    if (sev.includes("minor") || sev.includes("moderate")) return "sev3";
    return "sev3";
  }
  if (provider === "sentry") {
    const level = lower(p.data?.issue?.level || p.data?.event?.level || p.level);
    if (level === "fatal") return "sev1";
    if (level === "error") return "sev2";
    if (level === "warning") return "sev3";
    if (level) return "sev4";
    return "sev3";
  }
  return "sev3";
}

function serviceFor(provider, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (provider === "pagerduty") {
    return String(p.event?.data?.service?.summary || "").slice(0, 200) || null;
  }
  if (provider === "sentry") {
    return String(p.data?.issue?.project?.slug || "").slice(0, 200) || null;
  }
  return null;
}

function environmentFor(provider, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (provider === "sentry") {
    return String(p.data?.event?.environment || p.data?.issue?.environment || "").slice(0, 120) || null;
  }
  return null;
}

function systemUserId(provider) {
  return `integration:${provider}`;
}

/**
 * Open/update the tracked incident for a verified provider event.
 * Creation needs a room (incidents.room_id NOT NULL): the entity link room.
 * @returns {Promise<null | { action: string, incidentId?: string, severity?: string, reason?: string }>}
 */
export async function syncProviderIncident(env, { projectId, provider, mapped, payload, roomId }) {
  const p = lower(provider);
  if (!INCIDENT_PROVIDERS.has(p)) return null;
  const alertId = String(mapped?.entityId || "").slice(0, 256);
  if (!alertId) return { action: "skipped", reason: "missing_alert_id" };
  const phase = classifyProviderIncidentEvent(p, payload);
  if (!phase) return { action: "skipped", reason: "unclassified" };

  const existing = await env.DB.prepare(
    `SELECT * FROM incidents WHERE project_id = ? AND alert_source = ? AND alert_id = ? LIMIT 1`,
  )
    .bind(projectId, p, alertId)
    .first();

  if (!existing) {
    if (phase !== "open") return { action: "orphan", reason: "incident_not_found" };
    if (!roomId) return { action: "skipped", reason: "no_room" };
    const severity = incidentSeverityFor(p, payload);
    const title = String(mapped.title || `${p} incident`).slice(0, 200);
    const created = await createIncident(env, {
      projectId,
      roomId,
      title,
      description: String(mapped.body || "").slice(0, 2000),
      severity,
      alertSource: p,
      alertId,
      environment: environmentFor(p, payload),
      service: serviceFor(p, payload),
    });
    const alert = await ingestAlert(env, {
      projectId,
      roomId,
      source: p,
      alertType: String(mapped.kind || "alert").slice(0, 80),
      title,
      payload: { provider: p, kind: mapped.kind, entityId: alertId, severity },
    });
    await linkAlertToIncident(env, { projectId, alertId: alert.id, incidentId: created.id });
    await addIncidentUpdate(env, {
      projectId,
      incidentId: created.id,
      userId: systemUserId(p),
      updateType: "alert",
      content: `${mapped.kind || "alert"}: ${title}`.slice(0, 500),
      metadata: { provider: p, kind: mapped.kind, entityId: alertId, severity },
    });
    return { action: "created", incidentId: created.id, severity };
  }

  const current = lower(existing.status);
  if (phase === "acknowledged" && current === "open") {
    await updateIncident(env, { projectId, incidentId: existing.id, status: "acknowledged" });
  } else if (phase === "resolved" && current !== "resolved" && current !== "closed") {
    await updateIncident(env, { projectId, incidentId: existing.id, status: "resolved" });
  }
  await addIncidentUpdate(env, {
    projectId,
    incidentId: existing.id,
    userId: systemUserId(p),
    updateType: phase === "resolved" ? "resolution" : phase === "acknowledged" ? "status_change" : "alert",
    content: `${mapped.kind || phase}: ${String(mapped.title || alertId)}`.slice(0, 500),
    metadata: { provider: p, kind: mapped.kind, entityId: alertId, phase },
  });
  return { action: phase, incidentId: existing.id };
}

/**
 * Incident → ops run: when the workspace policy names a published workflow for
 * the incident phase (policy.incidentWorkflowSlugs; "created" also honors the
 * legacy policy.incidentWorkflowSlug), the event starts it in the incident
 * room (approval-gated steps, citations, audit, room timeline).
 */
export async function startIncidentWorkflowIfConfigured(env, {
  projectId,
  provider,
  incident,
  mapped,
  roomId,
  store: injectedStore,
}) {
  if (!INCIDENT_PHASES.has(incident?.action) || !roomId) return { skipped: "not_applicable" };
  const { normalizeOpsPolicy, incidentWorkflowSlugFor } = await import("./ops-policy.js");
  const store = injectedStore || (await import("./ops-store-d1.js")).createD1OpsStore(env);
  const policy = normalizeOpsPolicy(await store.getPolicy(projectId));
  const slug = incidentWorkflowSlugFor(policy, incident.action);
  if (!slug) return { skipped: "not_configured" };
  const published = await store.latestPublished(projectId, slug);
  if (!published) return { skipped: "no_published_version", slug };
  const { startOpsRun } = await import("./ops-engine.js");
  const { executeOpsTool } = await import("./ops-sources.js");
  const title = String(mapped?.title || "Incident").slice(0, 200);
  const run = await startOpsRun(store, {
    env,
    projectId,
    version: published,
    trigger: {
      type: "webhook",
      source: "incident",
      provider,
      incidentId: incident.incidentId,
      phase: incident.action,
    },
    actor: `integration:${provider}`,
    roomId,
    context: {
      incident: {
        id: incident.incidentId,
        title,
        severity: incident.severity || null,
        provider,
        roomId,
        phase: incident.action,
      },
      toolInputs: { "files.search": { query: title } },
      // Provider payload text is attacker-influenced: the engine records
      // injection attempts instead of obeying them.
      untrustedText: String(mapped?.body || "").slice(0, 2000),
    },
    executeTool: (name, input, extra) =>
      executeOpsTool(store, policy, env, name, input, { ...extra, projectId }),
  });
  return { runId: run.id, slug, status: run.status, phase: incident.action };
}
