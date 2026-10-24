/**
 * Operations evidence pack: a deterministic summary of what the governed ops
 * layer actually did in a period — incidents, governed runs, approvals and the
 * control configuration in force. Counts come from live tables at generation
 * time; nothing is inferred, so the document can back a security
 * questionnaire or a SOC 2 evidence folder.
 */
import { getIncidentStats, listIncidents } from "./incident-response.js";
import { normalizeOpsPolicy } from "./ops-policy.js";
import { createD1OpsStore } from "./ops-store-d1.js";

const DEFAULT_DAYS = 90;
const MAX_RECENT_INCIDENTS = 10;
/** shortcut: period filtering reads the latest incidents only, not an index scan */
const INCIDENT_SCAN_LIMIT = 100;

function countBy(rows, pick) {
  const counts = {};
  for (const row of rows) {
    const key = pick(row) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function inPeriod(iso, since) {
  return Boolean(iso) && String(iso) >= since;
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return null;
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return null;
  const minutes = Math.round(total / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return minutes ? `${minutes}m` : `${Math.round(total)}s`;
}

function incidentDurationSeconds(incident) {
  if (!incident?.resolvedAt || !incident?.startedAt) return null;
  const delta = (Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt)) / 1000;
  return Number.isFinite(delta) && delta >= 0 ? Math.round(delta) : null;
}

export async function collectOpsEvidence(env, { projectId, days = DEFAULT_DAYS, store } = {}) {
  const periodDays = Math.min(Math.max(Math.trunc(Number(days)) || DEFAULT_DAYS, 1), 365);
  const since = new Date(Date.now() - periodDays * 86400000).toISOString();
  const opsStore = store || env?.OPS_STORE || createD1OpsStore(env);

  const stats = (await getIncidentStats(env, { projectId }).catch(() => null)) || {};
  const incidents = (await listIncidents(env, { projectId, limit: INCIDENT_SCAN_LIMIT }).catch(() => [])) || [];
  const incidentsInPeriod = incidents.filter((incident) =>
    inPeriod(incident.resolvedAt || incident.startedAt, since),
  );
  const resolvedInPeriod = incidentsInPeriod.filter(
    (incident) => incident.status === "resolved" || incident.status === "closed",
  );

  const runs = (await opsStore.listRuns(projectId)).filter((run) =>
    inPeriod(run.updatedAt || run.createdAt, since),
  );
  const approvals = (await opsStore.listApprovals(projectId)).filter((row) =>
    inPeriod(row.createdAt, since),
  );
  const policy = normalizeOpsPolicy(await opsStore.getPolicy(projectId));
  const tools = await opsStore.listTools(projectId).catch(() => []);

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    periodDays,
    since,
    incidents: {
      total: stats.total || 0,
      bySeverity: stats.bySeverity || {},
      byStatus: stats.byStatus || {},
      avgMttrSeconds: stats.avgMttrSeconds ?? null,
      avgMttaSeconds: stats.avgMttaSeconds ?? null,
      inPeriod: incidentsInPeriod.length,
      resolvedInPeriod: resolvedInPeriod.length,
      postmortemsInPeriod: resolvedInPeriod.filter((incident) => incident.postmortem).length,
      recent: incidentsInPeriod.slice(0, MAX_RECENT_INCIDENTS).map((incident) => ({
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        resolvedAt: incident.resolvedAt || null,
        durationSeconds: incidentDurationSeconds(incident),
        hasPostmortem: Boolean(incident.postmortem),
      })),
    },
    runs: {
      inPeriod: runs.length,
      byStatus: countBy(runs, (run) => run.status),
      toolCalls: runs.reduce((sum, run) => sum + (run.cost?.toolCalls || 0), 0),
      tokens: runs.reduce((sum, run) => sum + (run.cost?.tokens || 0), 0),
    },
    approvals: {
      inPeriod: approvals.length,
      byStatus: countBy(approvals, (row) => row.status),
    },
    governance: {
      incidentWorkflowSlug: policy.incidentWorkflowSlug,
      incidentWorkflowSlugs: policy.incidentWorkflowSlugs,
      defaultWriteEffect: policy.defaultWriteEffect,
      highRiskQuorum: policy.highRiskQuorum,
      budgets: policy.budgets,
      tools: (tools || []).map((tool) => ({
        name: tool.name,
        side: tool.side,
        risk: tool.risk,
        requiresApproval: Boolean(tool.requiresApproval),
        enabled: tool.enabled !== false,
      })),
    },
  };
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {});
  if (!entries.length) return "none";
  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

/** "created" falls back to the legacy knob; later phases list only when set. */
function formatIncidentWorkflow(governance) {
  const phase = governance.incidentWorkflowSlugs || {};
  const created = phase.created || governance.incidentWorkflowSlug || null;
  const later = [
    ["acknowledged", phase.acknowledged],
    ["resolved", phase.resolved],
  ].filter(([, slug]) => slug);
  if (!later.length) return created || "not configured";
  const parts = [...(created ? [["created", created]] : []), ...later].map(([name, slug]) => `${name}: ${slug}`);
  return parts.join(" · ");
}

export function renderOpsEvidence(evidence) {
  const lines = [
    "# Operations evidence pack",
    "",
    `Generated: ${evidence.generatedAt} · Period: last ${evidence.periodDays} days (since ${evidence.since})`,
    "",
    "## Incident response",
    `- Incidents in period: ${evidence.incidents.inPeriod} (resolved ${evidence.incidents.resolvedInPeriod}, postmortems ${evidence.incidents.postmortemsInPeriod})`,
    `- All-time: ${evidence.incidents.total} by severity (${formatCounts(evidence.incidents.bySeverity)}) · by status (${formatCounts(evidence.incidents.byStatus)})`,
    `- Mean time to resolve: ${formatSeconds(evidence.incidents.avgMttrSeconds) || "n/a"} · mean time to acknowledge: ${formatSeconds(evidence.incidents.avgMttaSeconds) || "n/a"}`,
  ];
  if (evidence.incidents.recent.length) {
    lines.push("", "### Recent incidents");
    for (const incident of evidence.incidents.recent) {
      const duration = formatSeconds(incident.durationSeconds);
      lines.push(
        `- [${incident.severity}] ${incident.title} — ${incident.status}` +
          `${duration ? `, ${duration}` : ""}, postmortem: ${incident.hasPostmortem ? "yes" : "no"}`,
      );
    }
  }
  lines.push(
    "",
    "## Governed agent runs",
    `- Runs in period: ${evidence.runs.inPeriod} (${formatCounts(evidence.runs.byStatus)})`,
    `- Tool calls: ${evidence.runs.toolCalls} · tokens: ${evidence.runs.tokens}`,
    "",
    "## Approvals",
    `- Approvals in period: ${evidence.approvals.inPeriod} (${formatCounts(evidence.approvals.byStatus)})`,
    "",
    "## Governance controls in force",
    `- Incident workflow: ${formatIncidentWorkflow(evidence.governance)}`,
    `- Default write effect: ${evidence.governance.defaultWriteEffect} · high-risk quorum: ${evidence.governance.highRiskQuorum}`,
    `- Run budgets: ${evidence.governance.budgets?.maxToolCallsPerRun ?? "n/a"} tool calls / ${evidence.governance.budgets?.maxTokensPerRun ?? "n/a"} tokens`,
  );
  if (evidence.governance.tools.length) {
    lines.push("- Agent tools:");
    for (const tool of evidence.governance.tools) {
      const flags = [
        tool.side || "unknown",
        tool.risk || "unknown",
        tool.requiresApproval ? "approval required" : null,
        tool.enabled ? null : "disabled",
      ].filter(Boolean);
      lines.push(`  - ${tool.name} (${flags.join(", ")})`);
    }
  }
  lines.push(
    "",
    "## Provenance",
    "Counts read from live tables (incidents, ops_runs, ops_approvals, ops_tools, ops_policies) at generation time.",
  );
  return `${lines.join("\n")}\n`;
}

export async function generateOpsEvidence(env, { projectId, days, store } = {}) {
  const evidence = await collectOpsEvidence(env, { projectId, days, store });
  return { evidence, document: renderOpsEvidence(evidence) };
}
