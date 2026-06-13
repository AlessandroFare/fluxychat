import { describe, it, expect } from "vitest";
import {
  createIncident, getIncident, listIncidents, updateIncident,
  addIncidentUpdate, getIncidentTimeline,
  ingestAlert, acknowledgeAlert, linkAlertToIncident, listAlerts,
  setPostmortem, getIncidentStats,
} from "../lib/incident-response.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return {
    prepare: () => ({
      bind: () => ({ run, first, all }),
    }),
  };
}

function mockDbRouter(responses) {
  let callIndex = 0;
  return {
    prepare: (sql) => ({
      bind: () => ({
        run: async () => { callIndex++; return { meta: { changes: 1 } }; },
        first: async () => responses[callIndex++]?.first ?? null,
        all: async () => ({ results: responses[callIndex++]?.all ?? [] }),
      }),
    }),
  };
}

function makeIncident(overrides = {}) {
  return {
    id: "i1", project_id: "p1", room_id: "r1", title: "DB Down",
    description: "Primary DB unreachable", severity: "sev1", status: "open",
    commander_id: "u1", oncall_user_id: null, alert_source: null, alert_id: null,
    environment: null, service: null, started_at: "2026-01-01T00:00:00Z",
    acknowledged_at: null, resolved_at: null, closed_at: null,
    postmortem: null, root_cause: null, action_items: "[]", timeline: "[]",
    mttr_seconds: null, created_at: "2026-01-01", ...overrides,
  };
}

describe("incident-response", () => {
  describe("createIncident", () => {
    it("creates incident", async () => {
      const env = { DB: mockDb() };
      const inc = await createIncident(env, {
        projectId: "p1", roomId: "r1", title: "DB Down",
        severity: "sev1", commanderId: "u1", service: "database",
      });
      expect(inc.id).toBeDefined();
      expect(inc.title).toBe("DB Down");
      expect(inc.severity).toBe("sev1");
      expect(inc.status).toBe("open");
    });

    it("rejects invalid severity", async () => {
      const env = { DB: mockDb() };
      await expect(
        createIncident(env, { projectId: "p1", roomId: "r1", title: "x", severity: "sev5" })
      ).rejects.toThrow("Invalid severity");
    });
  });

  describe("getIncident", () => {
    it("returns formatted incident", async () => {
      const env = { DB: mockDb([makeIncident({ alert_source: "pagerduty", alert_id: "pd123", environment: "prod", service: "database" })])};
      const inc = await getIncident(env, { projectId: "p1", incidentId: "i1" });
      expect(inc.title).toBe("DB Down");
      expect(inc.severity).toBe("sev1");
      expect(inc.alertSource).toBe("pagerduty");
      expect(inc.service).toBe("database");
    });
  });

  describe("listIncidents", () => {
    it("filters by status", async () => {
      const env = { DB: mockDb([makeIncident()])};
      const incs = await listIncidents(env, { projectId: "p1", status: "open" });
      expect(incs).toHaveLength(1);
    });
  });

  describe("updateIncident", () => {
    it("acknowledges incident", async () => {
      const updated = makeIncident({ status: "acknowledged", acknowledged_at: "2026-01-01T00:05:00Z" });
      const env = { DB: mockDbRouter([
        { first: makeIncident() }, // getIncident (check exists)
        {},                         // UPDATE (run)
        { first: updated },         // getIncident (return updated)
      ])};
      const inc = await updateIncident(env, {
        projectId: "p1", incidentId: "i1", status: "acknowledged",
      });
      expect(inc.status).toBe("acknowledged");
    });

    it("throws for missing incident", async () => {
      const env = { DB: mockDbRouter([{ first: null }]) };
      await expect(
        updateIncident(env, { projectId: "p1", incidentId: "missing", status: "resolved" })
      ).rejects.toThrow("Incident not found");
    });
  });

  describe("addIncidentUpdate", () => {
    it("adds comment", async () => {
      const env = { DB: mockDb() };
      const update = await addIncidentUpdate(env, {
        projectId: "p1", incidentId: "i1", userId: "u1",
        updateType: "comment", content: "Investigating DB logs",
      });
      expect(update.id).toBeDefined();
      expect(update.updateType).toBe("comment");
    });

    it("rejects invalid update type", async () => {
      const env = { DB: mockDb() };
      await expect(
        addIncidentUpdate(env, {
          projectId: "p1", incidentId: "i1", userId: "u1",
          updateType: "invalid", content: "x",
        })
      ).rejects.toThrow("Invalid update type");
    });
  });

  describe("getIncidentTimeline", () => {
    it("returns timeline", async () => {
      const env = { DB: mockDb([
        { id: "u1", incident_id: "i1", project_id: "p1", user_id: "u1", update_type: "comment", content: "Starting investigation", metadata: "{}", created_at: "2026-01-01T00:00:00Z" },
        { id: "u2", incident_id: "i1", project_id: "p1", user_id: "u2", update_type: "status_change", content: "Acknowledged", metadata: '{"from":"open","to":"acknowledged"}', created_at: "2026-01-01T00:05:00Z" },
      ])};
      const timeline = await getIncidentTimeline(env, { projectId: "p1", incidentId: "i1" });
      expect(timeline).toHaveLength(2);
      expect(timeline[0].updateType).toBe("comment");
      expect(timeline[1].metadata.from).toBe("open");
    });
  });

  describe("ingestAlert", () => {
    it("ingests alert", async () => {
      const env = { DB: mockDb() };
      const alert = await ingestAlert(env, {
        projectId: "p1", roomId: "r1", source: "pagerduty",
        alertType: "cpu_high", title: "CPU > 95%",
        payload: { host: "web-01", value: 97.2 },
      });
      expect(alert.id).toBeDefined();
      expect(alert.source).toBe("pagerduty");
      expect(alert.status).toBe("new");
    });
  });

  describe("acknowledgeAlert", () => {
    it("acknowledges alert", async () => {
      const env = { DB: mockDb() };
      const ok = await acknowledgeAlert(env, { projectId: "p1", alertId: "a1", userId: "u1" });
      expect(ok).toBe(true);
    });
  });

  describe("linkAlertToIncident", () => {
    it("links alert", async () => {
      const env = { DB: mockDb() };
      const ok = await linkAlertToIncident(env, { projectId: "p1", alertId: "a1", incidentId: "i1" });
      expect(ok).toBe(true);
    });
  });

  describe("listAlerts", () => {
    it("lists alerts", async () => {
      const env = { DB: mockDb([
        { id: "a1", incident_id: null, project_id: "p1", room_id: "r1", source: "opsgenie", alert_type: "disk", title: "Disk 90%", payload: "{}", status: "new", acknowledged_by: null, created_at: "2026-01-01" },
      ])};
      const alerts = await listAlerts(env, { projectId: "p1", roomId: "r1" });
      expect(alerts).toHaveLength(1);
    });
  });

  describe("setPostmortem", () => {
    it("sets postmortem", async () => {
      const updated = makeIncident({
        status: "resolved", postmortem: "Root cause identified",
        root_cause: "Pool exhaustion", action_items: '["Add alerts for pool usage"]',
      });
      const env = { DB: mockDbRouter([
        {},                         // UPDATE (run)
        { first: updated },         // getIncident (return updated)
      ])};
      const inc = await setPostmortem(env, {
        projectId: "p1", incidentId: "i1",
        postmortem: "Root cause identified", rootCause: "Pool exhaustion",
        actionItems: ["Add alerts for pool usage"],
      });
      expect(inc.postmortem).toBe("Root cause identified");
    });
  });

  describe("getIncidentStats", () => {
    it("returns stats", async () => {
      const env = { DB: mockDbRouter([
        { first: { total: 25 } },
        { all: [
          { severity: "sev1", count: 3 },
          { severity: "sev2", count: 7 },
          { severity: "sev3", count: 10 },
          { severity: "sev4", count: 5 },
        ]},
        { all: [
          { status: "resolved", count: 20 },
          { status: "open", count: 5 },
        ]},
        { first: { avg_mttr: 3600 } },
        { first: { avg_mtta: 300 } },
      ])};
      const stats = await getIncidentStats(env, { projectId: "p1" });
      expect(stats.total).toBe(25);
      expect(stats.avgMttrSeconds).toBe(3600);
      expect(stats.avgMttaSeconds).toBe(300);
    });
  });
});
