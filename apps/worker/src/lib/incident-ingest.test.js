import { describe, expect, it } from "vitest";
import {
  INCIDENT_PROVIDERS,
  classifyProviderIncidentEvent,
  incidentSeverityFor,
  startIncidentWorkflowIfConfigured,
  syncProviderIncident,
} from "./incident-ingest.js";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy } from "./ops-policy.js";

function dbWith({ incident = null } = {}) {
  const sqlLog = [];
  return {
    sqlLog,
    DB: {
      prepare(sql) {
        sqlLog.push(sql);
        return {
          bind() {
            return {
              async first() {
                return sql.includes("FROM incidents") ? incident : null;
              },
              async run() {
                return { meta: { changes: 1 } };
              },
              async all() {
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };
}

const pd = (type, data = {}) => ({ event: { id: `evt-${type}`, event_type: type, data } });
const mapped = {
  entityId: "PD1",
  kind: "incident.triggered",
  title: "DB down",
  body: "postgres unavailable",
};
const existingIncident = {
  id: "i1",
  project_id: "p1",
  room_id: "r1",
  status: "open",
  severity: "sev2",
  title: "DB down",
  started_at: new Date(Date.now() - 60_000).toISOString(),
  action_items: "[]",
  timeline: "[]",
};

describe("classifyProviderIncidentEvent", () => {
  it("maps PagerDuty lifecycle events", () => {
    expect(classifyProviderIncidentEvent("pagerduty", pd("incident.triggered"))).toBe("open");
    expect(classifyProviderIncidentEvent("pagerduty", pd("incident.acknowledged"))).toBe("acknowledged");
    expect(classifyProviderIncidentEvent("pagerduty", pd("incident.resolved"))).toBe("resolved");
    expect(classifyProviderIncidentEvent("pagerduty", pd("incident.escalated"))).toBe("update");
    expect(classifyProviderIncidentEvent("pagerduty", {})).toBeNull();
  });

  it("maps incident.io v2 payloads (public_incident)", () => {
    expect(
      classifyProviderIncidentEvent("incidentio", {
        event_type: "public_incident.incident_created_v2",
      }),
    ).toBe("open");
    expect(
      classifyProviderIncidentEvent("incidentio", {
        event_type: "public_incident.incident_updated_v2",
        public_incident: { status: "resolved" },
      }),
    ).toBe("resolved");
    expect(
      classifyProviderIncidentEvent("incidentio", {
        event_type: "public_incident.incident_updated_v2",
        public_incident: { status: "live" },
      }),
    ).toBe("update");
  });

  it("maps Sentry issue actions", () => {
    expect(classifyProviderIncidentEvent("sentry", { action: "created" })).toBe("open");
    expect(classifyProviderIncidentEvent("sentry", { action: "resolved" })).toBe("resolved");
    expect(classifyProviderIncidentEvent("sentry", { action: "assigned" })).toBe("update");
    expect(classifyProviderIncidentEvent("github", { action: "created" })).toBeNull();
  });
});

describe("incidentSeverityFor", () => {
  it("uses PagerDuty priority before urgency", () => {
    expect(
      incidentSeverityFor("pagerduty", pd("incident.triggered", { priority: { name: "P1" }, urgency: "low" })),
    ).toBe("sev1");
    expect(incidentSeverityFor("pagerduty", pd("incident.triggered", { urgency: "high" }))).toBe("sev2");
    expect(incidentSeverityFor("pagerduty", pd("incident.triggered", { urgency: "low" }))).toBe("sev3");
  });

  it("maps incident.io and Sentry severities", () => {
    expect(
      incidentSeverityFor("incidentio", { incident: { severity: { name: "Critical" } } }),
    ).toBe("sev1");
    expect(
      incidentSeverityFor("incidentio", { public_incident: { severity: { name: "Major" } } }),
    ).toBe("sev2");
    expect(incidentSeverityFor("sentry", { data: { issue: { level: "fatal" } } })).toBe("sev1");
    expect(incidentSeverityFor("sentry", { data: { issue: { level: "error" } } })).toBe("sev2");
  });
});

describe("syncProviderIncident", () => {
  it("only handles incident-class providers", async () => {
    expect(INCIDENT_PROVIDERS.has("pagerduty")).toBe(true);
    const result = await syncProviderIncident(dbWith(), {
      projectId: "p1",
      provider: "github",
      mapped,
      payload: {},
      roomId: "r1",
    });
    expect(result).toBeNull();
  });

  it("opens a tracked incident from a trigger event", async () => {
    const env = dbWith();
    const result = await syncProviderIncident(env, {
      projectId: "p1",
      provider: "pagerduty",
      mapped,
      payload: pd("incident.triggered", { id: "PD1", title: "DB down", urgency: "high" }),
      roomId: "r1",
    });
    expect(result).toMatchObject({ action: "created", severity: "sev2" });
    expect(result.incidentId).toBeTruthy();
    expect(env.sqlLog.some((sql) => sql.includes("INSERT INTO incidents"))).toBe(true);
    expect(env.sqlLog.some((sql) => sql.includes("INSERT INTO incident_alerts"))).toBe(true);
    expect(env.sqlLog.some((sql) => sql.includes("INSERT INTO incident_updates"))).toBe(true);
  });

  it("needs a room to open a new incident", async () => {
    const result = await syncProviderIncident(dbWith(), {
      projectId: "p1",
      provider: "pagerduty",
      mapped,
      payload: pd("incident.triggered", { id: "PD1", title: "DB down" }),
      roomId: null,
    });
    expect(result).toMatchObject({ action: "skipped", reason: "no_room" });
  });

  it("acknowledges and resolves the tracked incident", async () => {
    const ackEnv = dbWith({ incident: existingIncident });
    const ack = await syncProviderIncident(ackEnv, {
      projectId: "p1",
      provider: "pagerduty",
      mapped,
      payload: pd("incident.acknowledged", { id: "PD1", title: "DB down" }),
      roomId: "r1",
    });
    expect(ack).toMatchObject({ action: "acknowledged", incidentId: "i1" });
    expect(ackEnv.sqlLog.some((sql) => sql.includes("UPDATE incidents SET"))).toBe(true);

    const resolveEnv = dbWith({ incident: existingIncident });
    const resolved = await syncProviderIncident(resolveEnv, {
      projectId: "p1",
      provider: "pagerduty",
      mapped,
      payload: pd("incident.resolved", { id: "PD1", title: "DB down" }),
      roomId: "r1",
    });
    expect(resolved).toMatchObject({ action: "resolved", incidentId: "i1" });
    const update = resolveEnv.sqlLog.find((sql) => sql.includes("UPDATE incidents SET"));
    expect(update).toContain("resolved_at");
  });

  it("keeps update events on the timeline without touching status", async () => {
    const env = dbWith({ incident: existingIncident });
    const result = await syncProviderIncident(env, {
      projectId: "p1",
      provider: "pagerduty",
      mapped,
      payload: pd("incident.escalated", { id: "PD1", title: "DB down" }),
      roomId: "r1",
    });
    expect(result).toMatchObject({ action: "update", incidentId: "i1" });
    expect(env.sqlLog.some((sql) => sql.includes("UPDATE incidents SET"))).toBe(false);
    expect(env.sqlLog.some((sql) => sql.includes("INSERT INTO incident_updates"))).toBe(true);
  });

  it("does not invent an incident from an orphan resolve", async () => {
    const env = dbWith();
    const result = await syncProviderIncident(env, {
      projectId: "p1",
      provider: "pagerduty",
      mapped,
      payload: pd("incident.resolved", { id: "PD1", title: "DB down" }),
      roomId: "r1",
    });
    expect(result).toMatchObject({ action: "orphan", reason: "incident_not_found" });
    expect(env.sqlLog.some((sql) => sql.includes("INSERT INTO incidents"))).toBe(false);
  });
});

describe("startIncidentWorkflowIfConfigured", () => {
  const createdIncident = { action: "created", incidentId: "i1", severity: "sev2" };

  it("starts the configured published workflow in the incident room", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy("p1", { ...defaultOpsPolicy(), incidentWorkflowSlug: "incident-response" }, "admin");
    const def = await store.createDefinition({ projectId: "p1", slug: "incident-response", createdBy: "u1" });
    await store.saveVersion({
      projectId: "p1",
      definitionId: def.id,
      version: 1,
      status: "published",
      definition: { slug: "incident-response", steps: [{ id: "end", type: "end" }] },
      createdBy: "u1",
      publishedBy: "admin",
    });

    const result = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: createdIncident,
      mapped: { title: "DB down", body: "postgres unavailable" },
      roomId: "r1",
      store,
    });

    expect(result.runId).toBeTruthy();
    expect(result.status).toBe("done");
    const run = await store.getRun("p1", result.runId);
    expect(run.roomId).toBe("r1");
    expect(run.trigger).toMatchObject({ type: "webhook", source: "incident", provider: "pagerduty" });
    expect(run.context.incident).toMatchObject({ id: "i1", title: "DB down", severity: "sev2" });
    expect(run.context.toolInputs["files.search"].query).toBe("DB down");
  });

  it("skips when the policy names no workflow", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy("p1", defaultOpsPolicy(), "admin");
    const result = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: createdIncident,
      mapped,
      roomId: "r1",
      store,
    });
    expect(result).toMatchObject({ skipped: "not_configured" });
  });

  it("skips when the named workflow is not published", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy("p1", { ...defaultOpsPolicy(), incidentWorkflowSlug: "incident-response" }, "admin");
    const result = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: createdIncident,
      mapped,
      roomId: "r1",
      store,
    });
    expect(result).toMatchObject({ skipped: "no_published_version", slug: "incident-response" });
  });

  it("starts a per-phase workflow for acknowledged and resolved incidents", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy(
      "p1",
      {
        ...defaultOpsPolicy(),
        incidentWorkflowSlugs: { created: "incident-response", acknowledged: "ack-flow", resolved: "postmortem" },
      },
      "admin",
    );
    for (const slug of ["incident-response", "ack-flow", "postmortem"]) {
      const def = await store.createDefinition({ projectId: "p1", slug, createdBy: "u1" });
      await store.saveVersion({
        projectId: "p1",
        definitionId: def.id,
        version: 1,
        status: "published",
        definition: { slug, steps: [{ id: "end", type: "end" }] },
        createdBy: "u1",
        publishedBy: "admin",
      });
    }

    const ack = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: { action: "acknowledged", incidentId: "i1" },
      mapped,
      roomId: "r1",
      store,
    });
    expect(ack).toMatchObject({ slug: "ack-flow", phase: "acknowledged", status: "done" });
    const run = await store.getRun("p1", ack.runId);
    expect(run.trigger).toMatchObject({ type: "webhook", source: "incident", provider: "pagerduty", phase: "acknowledged" });
    expect(run.context.incident).toMatchObject({ id: "i1", phase: "acknowledged" });

    const resolved = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: { action: "resolved", incidentId: "i1" },
      mapped,
      roomId: "r1",
      store,
    });
    expect(resolved).toMatchObject({ slug: "postmortem", phase: "resolved", status: "done" });
  });

  it("does not reuse the created-phase slug for later phases", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy("p1", { ...defaultOpsPolicy(), incidentWorkflowSlug: "incident-response" }, "admin");
    const result = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: { action: "acknowledged", incidentId: "i1" },
      mapped,
      roomId: "r1",
      store,
    });
    expect(result).toMatchObject({ skipped: "not_configured" });
  });

  it("ignores incident events with no lifecycle phase", async () => {
    const store = createMemoryOpsStore();
    const result = await startIncidentWorkflowIfConfigured({}, {
      projectId: "p1",
      provider: "pagerduty",
      incident: { action: "updated", incidentId: "i1" },
      mapped,
      roomId: "r1",
      store,
    });
    expect(result).toMatchObject({ skipped: "not_applicable" });
  });
});
