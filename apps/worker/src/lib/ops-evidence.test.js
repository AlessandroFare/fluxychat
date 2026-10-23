import { describe, expect, it } from "vitest";
import { collectOpsEvidence, generateOpsEvidence, renderOpsEvidence } from "./ops-evidence.js";
import { defaultOpsPolicy } from "./ops-policy.js";
import { createMemoryOpsStore } from "./ops-store.js";

function dbWith({ total = 0, severities = [], statuses = [], mttr = null, mtta = null, incidents = [] } = {}) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("avg_mttr")) return { avg_mttr: mttr, avg_mtta: mtta };
                if (sql.includes("avg_mtta")) return { avg_mtta: mtta };
                if (sql.includes("COUNT(*)")) return { total };
                return null;
              },
              async all() {
                if (sql.includes("GROUP BY severity")) return { results: severities };
                if (sql.includes("GROUP BY status")) return { results: statuses };
                if (sql.includes("FROM incidents")) return { results: incidents };
                return { results: [] };
              },
              async run() {
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const recentIncident = {
  id: "i1",
  project_id: "p1",
  room_id: "r1",
  title: "DB down",
  description: "postgres unreachable",
  severity: "sev2",
  status: "resolved",
  service: "postgres",
  environment: "prod",
  alert_source: "pagerduty",
  alert_id: "PD1",
  started_at: iso(now - 2 * 3600 * 1000),
  acknowledged_at: iso(now - 2 * 3600 * 1000 + 5 * 60 * 1000),
  resolved_at: iso(now - 3600 * 1000),
  mttr_seconds: 3600,
  root_cause: "connection pool exhaustion",
  postmortem: "Blameless: pool sizing changed during the release.",
  action_items: "[]",
  timeline: "[]",
  created_at: iso(now - 2 * 3600 * 1000),
};

async function seededStore() {
  const store = createMemoryOpsStore();
  await store.putPolicy("p1", { ...defaultOpsPolicy(), incidentWorkflowSlug: "incident-response" }, "admin");
  await store.upsertTool("p1", { name: "notify.send", side: "write", risk: "medium", requiresApproval: true, enabled: true });
  await store.upsertTool("p1", { name: "files.search", side: "read", risk: "low", requiresApproval: false, enabled: true });
  await store.createRun({ projectId: "p1", roomId: "r1", versionId: "v1", status: "done", cost: { toolCalls: 5, tokens: 1000 } });
  await store.createRun({
    projectId: "p1",
    roomId: "r1",
    versionId: "v1",
    status: "failed",
    cost: { toolCalls: 9, tokens: 1 },
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  });
  await store.createApproval({ projectId: "p1", runId: "r1", stepId: "approve", required: 1, payloadHash: "h" });
  await store.createApproval({
    projectId: "p1",
    runId: "r1",
    stepId: "approve",
    status: "approved",
    createdAt: "2020-01-01T00:00:00.000Z",
  });
  return store;
}

describe("collectOpsEvidence", () => {
  it("counts incidents, governed runs and approvals in the period", async () => {
    const store = await seededStore();
    const env = dbWith({
      total: 4,
      severities: [{ severity: "sev2", count: 4 }],
      statuses: [{ status: "resolved", count: 3 }, { status: "open", count: 1 }],
      mttr: 1800,
      mtta: 300,
      incidents: [recentIncident],
    });

    const evidence = await collectOpsEvidence(env, { projectId: "p1", store });

    expect(evidence.periodDays).toBe(90);
    expect(evidence.incidents).toMatchObject({
      total: 4,
      bySeverity: { sev2: 4 },
      byStatus: { resolved: 3, open: 1 },
      avgMttrSeconds: 1800,
      avgMttaSeconds: 300,
      inPeriod: 1,
      resolvedInPeriod: 1,
      postmortemsInPeriod: 1,
    });
    expect(evidence.incidents.recent[0]).toMatchObject({
      id: "i1",
      severity: "sev2",
      durationSeconds: 3600,
      hasPostmortem: true,
    });
    // The 2020 run and approval fall outside the window.
    expect(evidence.runs).toMatchObject({ inPeriod: 1, byStatus: { done: 1 }, toolCalls: 5, tokens: 1000 });
    expect(evidence.approvals).toMatchObject({ inPeriod: 1, byStatus: { pending: 1 } });
    expect(evidence.governance.incidentWorkflowSlug).toBe("incident-response");
    expect(evidence.governance.tools.map((tool) => tool.name)).toEqual(["notify.send", "files.search"]);
  });

  it("narrows the period when asked", async () => {
    const store = await seededStore();
    await store.createRun({
      projectId: "p1",
      roomId: "r1",
      versionId: "v1",
      status: "done",
      cost: { toolCalls: 2, tokens: 10 },
      createdAt: iso(now - 3 * 86400000),
      updatedAt: iso(now - 3 * 86400000),
    });
    const env = dbWith({ incidents: [recentIncident] });

    const evidence = await collectOpsEvidence(env, { projectId: "p1", days: 1, store });

    expect(evidence.periodDays).toBe(1);
    expect(evidence.incidents.inPeriod).toBe(1); // 2h ago
    expect(evidence.runs.inPeriod).toBe(1); // only the fresh run
  });
});

describe("generateOpsEvidence", () => {
  it("renders a document with the real numbers and controls", async () => {
    const store = await seededStore();
    const env = dbWith({ total: 4, mttr: 1800, incidents: [recentIncident] });

    const { document } = await generateOpsEvidence(env, { projectId: "p1", store });

    expect(document).toContain("# Operations evidence pack");
    expect(document).toContain("Incidents in period: 1 (resolved 1, postmortems 1)");
    expect(document).toContain("Mean time to resolve: 30m");
    expect(document).toContain("[sev2] DB down — resolved, 1h 0m, postmortem: yes");
    expect(document).toContain("Runs in period: 1 (done: 1)");
    expect(document).toContain("Approvals in period: 1 (pending: 1)");
    expect(document).toContain("Incident workflow: incident-response");
    expect(document).toContain("notify.send (write, medium, approval required)");
    expect(document).toContain("files.search (read, low)");
  });

  it("renders phase-specific incident workflows", async () => {
    const store = await seededStore();
    await store.putPolicy(
      "p1",
      { ...defaultOpsPolicy(), incidentWorkflowSlugs: { resolved: "postmortem" } },
      "admin",
    );
    const env = dbWith({ total: 4, mttr: 1800, incidents: [recentIncident] });

    const { evidence, document } = await generateOpsEvidence(env, { projectId: "p1", store });

    expect(document).toContain("Incident workflow: resolved: postmortem");
    expect(evidence.governance.incidentWorkflowSlugs).toMatchObject({ created: null, resolved: "postmortem" });
  });

  it("renders an empty project without inventing facts", async () => {
    const { evidence, document } = await generateOpsEvidence(dbWith(), {
      projectId: "p1",
      store: createMemoryOpsStore(),
    });
    expect(evidence.incidents.total).toBe(0);
    expect(document).toContain("Incidents in period: 0 (resolved 0, postmortems 0)");
    expect(document).toContain("Mean time to resolve: n/a");
    expect(document).toContain("Incident workflow: not configured");
    expect(renderOpsEvidence(evidence)).toBe(document);
  });
});
