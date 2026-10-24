/**
 * Incident knowledge: a resolved incident (and its postmortem) becomes an ops
 * file under sourceId "incidents", so future triage `files.search` can cite
 * what happened last time. Deterministic markdown from the incident record +
 * timeline; no LLM, no cost. One file per incident, refreshed in place.
 */
import { getIncident, getIncidentTimeline } from "./incident-response.js";
import { deleteOpsFile, ingestOpsFile } from "./ops-sources.js";
import { createD1OpsStore } from "./ops-store-d1.js";

const MAX_TIMELINE_LINES = 40;
const MAX_CONTENT = 300;

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return null;
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return null;
  const minutes = Math.round(total / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return minutes ? `${minutes}m` : `${Math.round(total)}s`;
}

export function incidentReportKey(incidentId) {
  return `incident-${incidentId}.md`;
}

export function composeIncidentReport(incident, timeline = []) {
  const meta = [`- Severity: ${incident.severity || "sev3"}`, `- Status: ${incident.status || "open"}`];
  if (incident.service) meta.push(`- Service: ${incident.service}`);
  if (incident.environment) meta.push(`- Environment: ${incident.environment}`);
  if (incident.alertSource) {
    meta.push(`- Alert source: ${incident.alertSource}${incident.alertId ? ` (${incident.alertId})` : ""}`);
  }
  if (incident.startedAt) meta.push(`- Started: ${incident.startedAt}`);
  if (incident.acknowledgedAt) meta.push(`- Acknowledged: ${incident.acknowledgedAt}`);
  if (incident.resolvedAt) meta.push(`- Resolved: ${incident.resolvedAt}`);
  const duration = formatDuration(incident.mttrSeconds);
  if (duration) meta.push(`- Time to resolve: ${duration}`);

  const parts = [`# Incident: ${incident.title || "Untitled"}`, "", ...meta];
  if (incident.description) parts.push("", "## Description", incident.description);
  if (incident.rootCause) parts.push("", "## Root cause", incident.rootCause);
  if (incident.postmortem) parts.push("", "## Postmortem", incident.postmortem);

  const actionItems = Array.isArray(incident.actionItems) ? incident.actionItems : [];
  if (actionItems.length) {
    parts.push("", "## Action items");
    for (const item of actionItems) {
      const text =
        typeof item === "string" ? item : item?.text || item?.title || JSON.stringify(item);
      parts.push(`- [${typeof item === "object" && item?.done ? "x" : " "}] ${text}`);
    }
  }

  const entries = (Array.isArray(timeline) ? timeline : []).slice(-MAX_TIMELINE_LINES);
  if (entries.length) {
    parts.push("", "## Timeline");
    for (const entry of entries) {
      const line = `${entry.createdAt || ""} ${entry.updateType || "update"}: ${String(entry.content || "").slice(0, MAX_CONTENT)}`;
      parts.push(`- ${line.trim()}`);
    }
  }
  return `${parts.join("\n")}\n`;
}

export async function indexIncidentReport(env, { projectId, incidentId, store }) {
  const incident = await getIncident(env, { projectId, incidentId });
  if (!incident) return { skipped: "not_found" };
  // Knowledge is written when the incident ended or a postmortem exists;
  // an open incident without a postmortem is noise.
  if (incident.status !== "resolved" && !incident.postmortem) return { skipped: "not_resolved" };
  const timeline = await getIncidentTimeline(env, { projectId, incidentId }).catch(() => []);
  const text = composeIncidentReport(incident, timeline);
  const opsStore = store || env?.OPS_STORE || createD1OpsStore(env);
  const key = incidentReportKey(incidentId);
  const existing = (await opsStore.listFiles(projectId, "incidents")).find(
    (file) => file.key === key && file.sourceId === "incidents",
  );
  if (existing) {
    // Replace, not duplicate: deleteOpsFile also removes the search index item,
    // so the incident has exactly one report in the knowledge base.
    await deleteOpsFile(env, opsStore, { projectId, fileId: existing.id });
  }
  const file = await ingestOpsFile(env, opsStore, {
    projectId,
    sourceId: "incidents",
    key,
    contentType: "text/markdown",
    text,
  });
  return { ok: true, created: !existing, updated: Boolean(existing), fileId: file.id, key };
}
