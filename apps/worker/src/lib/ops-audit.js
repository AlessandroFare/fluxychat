import { buildSimplePdf } from "./room-export.js";
import { computeOversight } from "./ops-oversight.js";
import { AUDIT_CHAIN_GENESIS_HASH } from "./audit-chain.js";
import { AUDIT_RECEIPT_FORMAT, chainAuditRecords } from "./ops-receipts.js";

/**
 * Evidence pack for one run: the flow, every event, and the human decisions
 * (who approved or denied what, when, against which frozen payload hash).
 * The frozen payload itself stays out — the hash is the proof of what was
 * approved, and the input may hold sensitive values.
 */
export async function exportOpsAudit(store, { projectId, runId }) {
  const run = await store.getRun(projectId, runId);
  if (!run) return { ok: false, error: "not_found" };
  const events = await store.listEvents(projectId, runId);
  const steps = await store.listSteps(projectId, runId);
  const approvals = (await store.listApprovals(projectId))
    .filter((approval) => approval.runId === runId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map(redactApproval);
  const payload = {
    projectId,
    runId,
    roomId: run.roomId,
    status: run.status,
    versionId: run.versionId,
    cost: run.cost,
    steps,
    events: events.map(auditEvent),
    approvals,
    exportedAt: new Date().toISOString(),
  };
  return { ok: true, json: payload };
}

/**
 * Project-wide evidence export for a period: the rows behind an auditor's
 * question. Runs are redacted to their envelope — the run context can carry
 * trigger bodies and tool results.
 * shortcut: caps at 5000 events; narrow `from`/`to` window on bigger projects
 */
export async function exportOpsEvidence(store, { projectId, from = null, to = null } = {}) {
  const runs = (await store.listRuns(projectId))
    .filter((run) => inPeriod(run.updatedAt || run.createdAt, from, to))
    .map((run) => ({
      id: run.id,
      status: run.status,
      roomId: run.roomId,
      versionId: run.versionId,
      trigger: run.trigger?.type || "manual",
      cost: run.cost,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }));
  const events = await store.listEventsSince(projectId, { since: from, until: to, limit: 5000 });
  const periodApprovals = (await store.listApprovals(projectId))
    .filter((approval) => inPeriod(approval.createdAt, from, to))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return {
    ok: true,
    json: {
      projectId,
      from,
      to,
      exportedAt: new Date().toISOString(),
      // Oversight numbers travel with the evidence: an auditor can see whether
      // the humans behind the decisions were reviewing or rubber-stamping.
      oversight: computeOversight(periodApprovals, { events, from, to }),
      runs,
      events: events.map((event) => ({ runId: event.runId, ...auditEvent(event) })),
      approvals: periodApprovals.map(redactApproval),
    },
  };
}

function inPeriod(iso, from, to) {
  if (!iso) return !from && !to;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

/**
 * I4: sealed receipt for one run — the same records as the evidence pack, plus
 * a hash chain so the exported file proves itself offline, with no DB and no
 * trust in the exporter (`npm run verify:audit -- receipt.json`).
 */
export async function buildOpsRunReceipt(store, { projectId, runId }) {
  const exported = await exportOpsAudit(store, { projectId, runId });
  if (!exported.ok) return exported;
  const json = exported.json;
  const { records, tipHash } = await chainAuditRecords([
    {
      kind: "run",
      value: { projectId, runId, roomId: json.roomId, status: json.status, versionId: json.versionId, cost: json.cost },
    },
    ...json.steps.map((value) => ({ kind: "step", value })),
    ...json.events.map((value) => ({ kind: "event", value })),
    ...json.approvals.map((value) => ({ kind: "approval", value })),
  ]);
  return {
    ok: true,
    receipt: {
      format: AUDIT_RECEIPT_FORMAT,
      alg: "sha256",
      genesis: AUDIT_CHAIN_GENESIS_HASH,
      projectId,
      runId,
      roomId: json.roomId,
      status: json.status,
      exportedAt: json.exportedAt,
      counts: { steps: json.steps.length, events: json.events.length, approvals: json.approvals.length },
      records,
      tipHash,
    },
  };
}

/** I4: sealed receipt for the project evidence export of a period. */
export async function buildOpsEvidenceReceipt(store, { projectId, from = null, to = null } = {}) {
  const exported = await exportOpsEvidence(store, { projectId, from, to });
  if (!exported.ok) return exported;
  const json = exported.json;
  const { records, tipHash } = await chainAuditRecords([
    ...json.runs.map((value) => ({ kind: "run", value })),
    ...json.events.map((value) => ({ kind: "event", value })),
    ...json.approvals.map((value) => ({ kind: "approval", value })),
  ]);
  return {
    ok: true,
    receipt: {
      format: AUDIT_RECEIPT_FORMAT,
      alg: "sha256",
      genesis: AUDIT_CHAIN_GENESIS_HASH,
      projectId,
      from,
      to,
      exportedAt: json.exportedAt,
      counts: { runs: json.runs.length, events: json.events.length, approvals: json.approvals.length },
      records,
      tipHash,
    },
  };
}

function auditEvent(event) {
  return {
    at: event.createdAt,
    actor: event.actor,
    type: event.eventType,
    inputHash: event.inputHash,
    result: event.result,
  };
}

function redactApproval(approval) {
  return {
    id: approval.id,
    runId: approval.runId,
    stepId: approval.stepId,
    status: approval.status,
    payloadHash: approval.payloadHash,
    required: approval.required,
    createdAt: approval.createdAt,
    decisions: approval.decisions || [],
  };
}

function jsonlLine(record, row) {
  return JSON.stringify({ record, ...row });
}

/**
 * One JSON object per line — the system-of-record / SIEM feed an auditor can
 * ingest without parsing a single envelope (EU AI Act art. 12-style logs).
 */
export function opsAuditJsonl(json) {
  const { steps = [], events = [], approvals = [], ...run } = json;
  return `${[
    jsonlLine("run", run),
    ...steps.map((step) => jsonlLine("step", step)),
    ...events.map((event) => jsonlLine("event", event)),
    ...approvals.map((approval) => jsonlLine("approval", approval)),
  ].join("\n")}\n`;
}

export function opsEvidenceJsonl(json) {
  const { runs = [], events = [], approvals = [], ...header } = json;
  return `${[
    jsonlLine("header", header),
    ...runs.map((run) => jsonlLine("run", run)),
    ...events.map((event) => jsonlLine("event", event)),
    ...approvals.map((approval) => jsonlLine("approval", approval)),
  ].join("\n")}\n`;
}

export function opsAuditPdf(json) {
  const lines = [
    "FluxyOps audit trail",
    `Project: ${json.projectId}`,
    `Run: ${json.runId}`,
    `Status: ${json.status}`,
    `Exported: ${json.exportedAt}`,
    "",
    ...json.events.map((event) => `${event.at} ${event.actor} ${event.type} ${event.inputHash || ""}`),
  ];
  return buildSimplePdf(lines);
}
