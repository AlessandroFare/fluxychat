import { describe, expect, it } from "vitest";
import { composeIncidentReport, incidentReportKey, indexIncidentReport } from "./incident-knowledge.js";
import { createMemoryOpsStore } from "./ops-store.js";

function dbWith({ incident = null, updates = [] } = {}) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                return sql.includes("FROM incidents") ? incident : null;
              },
              async all() {
                return { results: sql.includes("FROM incident_updates") ? updates : [] };
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

const resolvedRow = {
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
  started_at: "2026-10-17T10:00:00.000Z",
  acknowledged_at: "2026-10-17T10:05:00.000Z",
  resolved_at: "2026-10-17T10:30:00.000Z",
  mttr_seconds: 1800,
  root_cause: "connection pool exhaustion",
  postmortem: "Blameless: pool sizing was changed during the release.",
  action_items: JSON.stringify([{ text: "Add pool saturation alert", done: false }, "Review pool config"]),
  timeline: "[]",
  created_at: "2026-10-17T10:00:00.000Z",
};

const timelineRows = [
  {
    id: "u1",
    incident_id: "i1",
    project_id: "p1",
    user_id: "integration:pagerduty",
    update_type: "alert",
    content: "incident.triggered: DB down",
    metadata: "{}",
    created_at: "2026-10-17T10:00:05.000Z",
  },
];

describe("composeIncidentReport", () => {
  it("renders the incident record, postmortem and timeline", () => {
    const report = composeIncidentReport(
      {
        title: "DB down",
        severity: "sev2",
        status: "resolved",
        service: "postgres",
        environment: "prod",
        alertSource: "pagerduty",
        alertId: "PD1",
        startedAt: "2026-10-17T10:00:00.000Z",
        resolvedAt: "2026-10-17T10:30:00.000Z",
        mttrSeconds: 1800,
        rootCause: "connection pool exhaustion",
        postmortem: "Blameless: pool sizing changed.",
        actionItems: [{ text: "Add pool alert", done: true }, "Review config"],
      },
      timelineRows.map((row) => ({ createdAt: row.created_at, updateType: row.update_type, content: row.content })),
    );
    expect(report).toContain("# Incident: DB down");
    expect(report).toContain("- Time to resolve: 30m");
    expect(report).toContain("## Root cause\nconnection pool exhaustion");
    expect(report).toContain("## Postmortem\nBlameless: pool sizing changed.");
    expect(report).toContain("- [x] Add pool alert");
    expect(report).toContain("- [ ] Review config");
    expect(report).toContain("incident.triggered: DB down");
  });

  it("caps the timeline so a long incident stays one readable file", () => {
    const timeline = Array.from({ length: 60 }, (_, index) => ({
      createdAt: `2026-10-17T10:${String(index).padStart(2, "0")}:00.000Z`,
      updateType: "comment",
      content: `entry ${index}`,
    }));
    const report = composeIncidentReport({ title: "Chatty", severity: "sev3", status: "resolved" }, timeline);
    expect(report).not.toContain("entry 19\n");
    expect(report).toContain("entry 20");
    expect(report).toContain("entry 59");
  });
});

describe("indexIncidentReport", () => {
  it("writes one report file per incident, refreshed in place", async () => {
    const store = createMemoryOpsStore();
    const env = dbWith({ incident: resolvedRow, updates: timelineRows });

    const first = await indexIncidentReport(env, { projectId: "p1", incidentId: "i1", store });
    expect(first).toMatchObject({ ok: true, created: true, key: incidentReportKey("i1") });
    let files = await store.listFiles("p1", "incidents");
    expect(files).toHaveLength(1);
    expect(files[0].text).toContain("Blameless: pool sizing was changed");

    const second = await indexIncidentReport(env, { projectId: "p1", incidentId: "i1", store });
    expect(second).toMatchObject({ ok: true, updated: true });
    files = await store.listFiles("p1", "incidents");
    expect(files).toHaveLength(1);
    expect(files[0].key).toBe(incidentReportKey("i1"));
  });

  it("skips unknown and unfinished incidents", async () => {
    const store = createMemoryOpsStore();
    const missing = await indexIncidentReport(dbWith(), { projectId: "p1", incidentId: "nope", store });
    expect(missing).toMatchObject({ skipped: "not_found" });

    const open = await indexIncidentReport(
      dbWith({ incident: { ...resolvedRow, status: "open", postmortem: null, resolved_at: null } }),
      { projectId: "p1", incidentId: "i1", store },
    );
    expect(open).toMatchObject({ skipped: "not_resolved" });
    expect(await store.listFiles("p1", "incidents")).toHaveLength(0);
  });
});
