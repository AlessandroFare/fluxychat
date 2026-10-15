import { buildSimplePdf } from "./room-export.js";

export async function exportOpsAudit(store, { projectId, runId }) {
  const run = await store.getRun(projectId, runId);
  if (!run) return { ok: false, error: "not_found" };
  const events = await store.listEvents(projectId, runId);
  const steps = await store.listSteps(projectId, runId);
  const payload = {
    projectId,
    runId,
    roomId: run.roomId,
    status: run.status,
    versionId: run.versionId,
    cost: run.cost,
    steps,
    events: events.map((event) => ({
      at: event.createdAt,
      actor: event.actor,
      type: event.eventType,
      inputHash: event.inputHash,
      result: event.result,
    })),
    exportedAt: new Date().toISOString(),
  };
  return { ok: true, json: payload };
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
