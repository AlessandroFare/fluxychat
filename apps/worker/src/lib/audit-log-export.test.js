import { describe, it, expect } from "vitest";
import {
  toCEF,
  toSyslog,
  toLEEF,
  createExportSchedule,
  listExportSchedules,
  deleteExportSchedule,
  toggleExportSchedule,
  queryFilteredAuditEvents,
  streamExport,
  recordExportRun,
  getExportRuns,
  getAuditStats,
} from "./audit-log-export.js";

function makeEnv() {
  const events = [];
  const schedules = [];
  const runs = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            return schedules.find((s) => s.id === params[0] && s.project_id === params[1]) || null;
          },
          all: async () => {
            if (sql.includes("audit_events") && sql.includes("GROUP BY")) {
              const groups = {};
              for (const e of events.filter((e) => e.project_id === params[0])) {
                const key = `${e.action}|${e.severity}`;
                groups[key] = groups[key] || { action: e.action, severity: e.severity, count: 0 };
                groups[key].count++;
              }
              return { results: Object.values(groups) };
            }
            if (sql.includes("audit_events")) {
              let filtered = events.filter((e) => e.project_id === params[0]);
              if (params[1]) filtered = filtered.filter((e) => e.timestamp >= params[1]);
              if (params[2]) filtered = filtered.filter((e) => e.timestamp <= params[2]);
              return { results: filtered.slice(0, params[params.length - 1] || 5000) };
            }
            if (sql.includes("audit_export_runs")) {
              return { results: runs.filter((r) => r.project_id === params[0]).slice(0, params[1] || 20) };
            }
            return { results: schedules.filter((s) => s.project_id === params[0]) };
          },
          run: async () => {
            if (sql.includes("INSERT INTO audit_export_schedules")) {
              schedules.push({
                id: params[0], project_id: params[1], name: params[2], frequency: params[3],
                format: params[4], filter_actor: params[5], filter_action: params[6],
                filter_resource: params[7], filter_severity: params[8], destination_type: params[9],
                destination_url: params[10], destination_config: params[11],
                enabled: params[12], next_run_at: params[13], created_at: params[14],
                last_run_at: null,
              });
            } else if (sql.includes("DELETE")) {
              const before = schedules.length;
              for (let i = schedules.length - 1; i >= 0; i--) {
                if (schedules[i].id === params[0] && schedules[i].project_id === params[1]) schedules.splice(i, 1);
              }
              return { meta: { changes: before - schedules.length } };
            } else if (sql.includes("UPDATE") && sql.includes("enabled")) {
              const idx = schedules.findIndex((s) => s.id === params[1]);
              if (idx >= 0) schedules[idx].enabled = params[0];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            } else if (sql.includes("INSERT INTO audit_export_runs")) {
              runs.push({ id: params[0], project_id: params[2], status: params[3], event_count: params[4] });
            } else if (sql.includes("UPDATE") && sql.includes("last_run_at")) {
              const idx = schedules.findIndex((s) => s.id === params[2]);
              if (idx >= 0) schedules[idx].last_run_at = params[0];
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _events: events,
  };
}

const sampleEvents = [
  { id: "e1", project_id: "p1", actor: "user1", action: "message.send", resource_type: "message", resource_id: "m1", room_id: "r1", details: "hello", severity: "info", timestamp: "2026-01-01T00:00:00Z" },
  { id: "e2", project_id: "p1", actor: "user2", action: "room.create", resource_type: "room", resource_id: "r2", room_id: "r2", details: "new room", severity: "notice", timestamp: "2026-01-02T00:00:00Z" },
  { id: "e3", project_id: "p1", actor: "user1", action: "user.login", resource_type: "session", resource_id: "s1", room_id: null, details: "login from 1.2.3.4", severity: "info", timestamp: "2026-01-03T00:00:00Z" },
];

describe("audit-log-export", () => {
  describe("format conversions", () => {
    it("toCEF produces CEF format", () => {
      const result = toCEF(sampleEvents);
      expect(result).toContain("CEF:0|FluxyChat|audit|1.0|message.send");
      expect(result).toContain("actor=user1");
      expect(result.split("\n").length).toBe(3);
    });

    it("toSyslog produces syslog format", () => {
      const result = toSyslog(sampleEvents);
      expect(result).toContain("user1");
      expect(result).toContain("message.send");
      expect(result.split("\n").length).toBe(3);
    });

    it("toLEEF produces LEEF format", () => {
      const result = toLEEF(sampleEvents);
      expect(result).toContain("LEEF:2.0|FluxyChat|audit|1.0|message.send");
      expect(result.split("\n").length).toBe(3);
    });
  });

  describe("schedules", () => {
    it("creates a schedule", async () => {
      const env = makeEnv();
      const result = await createExportSchedule(env, {
        projectId: "p1",
        name: "Daily SIEM",
        frequency: "daily",
        destinationType: "siem",
        destinationUrl: "https://siem.example.com/ingest",
      });
      expect(result.created).toBe(true);
    });

    it("requires name, frequency, destinationType", async () => {
      const env = makeEnv();
      const result = await createExportSchedule(env, { projectId: "p1" });
      expect(result.error).toContain("required");
    });

    it("validates frequency", async () => {
      const env = makeEnv();
      const result = await createExportSchedule(env, { projectId: "p1", name: "x", frequency: "hourly", destinationType: "webhook" });
      expect(result.error).toContain("daily, weekly, or monthly");
    });

    it("validates destinationType", async () => {
      const env = makeEnv();
      const result = await createExportSchedule(env, { projectId: "p1", name: "x", frequency: "daily", destinationType: "ftp" });
      expect(result.error).toContain("webhook, siem, or email");
    });
  });

  describe("stream export", () => {
    it("streams events as JSON", async () => {
      const env = makeEnv();
      env._events.push(...sampleEvents);
      const result = await streamExport(env, { projectId: "p1", startTime: "2025-01-01", endTime: "2026-12-31", format: "json" });
      const parsed = JSON.parse(result);
      expect(parsed.length).toBe(3);
    });

    it("streams as CEF", async () => {
      const env = makeEnv();
      env._events.push(...sampleEvents);
      const result = await streamExport(env, { projectId: "p1", startTime: "2025-01-01", endTime: "2026-12-31", format: "cef" });
      expect(result).toContain("CEF:0|FluxyChat");
    });

    it("streams as syslog", async () => {
      const env = makeEnv();
      env._events.push(...sampleEvents);
      const result = await streamExport(env, { projectId: "p1", startTime: "2025-01-01", endTime: "2026-12-31", format: "syslog" });
      expect(result).toContain("user1");
    });
  });

  describe("audit stats", () => {
    it("returns stats by action and severity", async () => {
      const env = makeEnv();
      env._events.push(...sampleEvents);
      const stats = await getAuditStats(env, { projectId: "p1" });
      expect(stats.totalEvents).toBe(3);
      expect(stats.byAction["message.send"]).toBe(1);
      expect(stats.bySeverity["info"]).toBe(2);
    });
  });
});
