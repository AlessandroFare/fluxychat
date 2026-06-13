import { describe, it, expect } from "vitest";
import {
  buildTraceSpan,
  buildOtelTracePayload,
  buildOtelMetricPayload,
  buildOtelLogPayload,
  traceToSpan,
  metricToOtel,
  logEntryToOtel,
} from "./otel-export.js";

describe("otel-export", () => {
  describe("buildTraceSpan", () => {
    it("creates a valid span with defaults", () => {
      const span = buildTraceSpan({ traceId: "abc123", name: "test-span" });
      expect(span.traceId).toBe("abc123");
      expect(span.spanId).toBeDefined();
      expect(span.spanId.length).toBe(32);
      expect(span.name).toBe("test-span");
      expect(span.kind).toBe(1);
      expect(span.status.code).toBe("OK");
    });

    it("includes attributes", () => {
      const span = buildTraceSpan({
        traceId: "t1",
        name: "action",
        attributes: { "fluxychat.project_id": "proj_1" },
      });
      expect(span.attributes).toEqual([
        { key: "fluxychat.project_id", value: { stringValue: "proj_1" } },
      ]);
    });

    it("includes resource attributes", () => {
      const span = buildTraceSpan({ traceId: "t1", name: "x" });
      expect(span.resource.attributes.length).toBeGreaterThan(0);
      const serviceName = span.resource.attributes.find((a) => a.key === "service.name");
      expect(serviceName.value.stringValue).toBe("fluxychat");
    });
  });

  describe("buildOtelTracePayload", () => {
    it("wraps spans in resourceSpans structure", () => {
      const span = buildTraceSpan({ traceId: "t1", name: "test" });
      const payload = buildOtelTracePayload([span]);
      expect(payload.resourceSpans).toHaveLength(1);
      expect(payload.resourceSpans[0].scopeSpans[0].spans).toHaveLength(1);
      expect(payload.resourceSpans[0].scopeSpans[0].scope.name).toBe("fluxychat-worker");
    });
  });

  describe("buildOtelMetricPayload", () => {
    it("wraps metrics in resourceMetrics structure", () => {
      const metric = { name: "test.metric", gauge: { dataPoints: [] } };
      const payload = buildOtelMetricPayload([metric]);
      expect(payload.resourceMetrics).toHaveLength(1);
      expect(payload.resourceMetrics[0].scopeMetrics[0].metrics).toHaveLength(1);
    });
  });

  describe("buildOtelLogPayload", () => {
    it("wraps logs in resourceLogs structure", () => {
      const log = { timeUnixNano: "123", severityNumber: 9, body: { stringValue: "test" } };
      const payload = buildOtelLogPayload([log]);
      expect(payload.resourceLogs).toHaveLength(1);
      expect(payload.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(1);
    });
  });

  describe("traceToSpan", () => {
    it("converts audit event row to span", () => {
      const row = {
        trace_id: "trace_abc",
        action: "admin.mute",
        project_id: "proj_1",
        target_type: "room",
        target_id: "room_1",
        actor_user_id: "user_1",
        created_at: "2026-06-12T00:00:00Z",
      };
      const span = traceToSpan(row);
      expect(span.traceId).toBe("trace_abc");
      expect(span.name).toBe("admin.mute");
      const projAttr = span.attributes.find((a) => a.key === "fluxychat.project_id");
      expect(projAttr.value.stringValue).toBe("proj_1");
    });
  });

  describe("metricToOtel", () => {
    it("converts operational metric row to OTEL metric", () => {
      const row = {
        metric_name: "messages_created",
        project_id: "proj_1",
        metric_value: 42,
        bucket_minute: "2026-06-12T10:00",
      };
      const metric = metricToOtel(row);
      expect(metric.name).toBe("fluxychat.messages_created");
      expect(metric.gauge.dataPoints[0].asInt).toBe(42);
      const projAttr = metric.gauge.dataPoints[0].attributes.find(
        (a) => a.key === "project_id"
      );
      expect(projAttr.value.stringValue).toBe("proj_1");
    });
  });

  describe("logEntryToOtel", () => {
    it("converts structured log entry to OTEL log record", () => {
      const entry = {
        level: "error",
        event: "webhook.failed",
        ts: "2026-06-12T00:00:00Z",
        projectId: "proj_1",
      };
      const log = logEntryToOtel(entry);
      expect(log.severityNumber).toBe(17);
      expect(log.severityText).toBe("ERROR");
      expect(log.body.stringValue).toBe("webhook.failed");
      const projAttr = log.attributes.find((a) => a.key === "projectId");
      expect(projAttr.value.stringValue).toBe("proj_1");
    });

    it("maps info level correctly", () => {
      const log = logEntryToOtel({ level: "info", event: "test", ts: "2026-06-12T00:00:00Z" });
      expect(log.severityNumber).toBe(9);
      expect(log.severityText).toBe("INFO");
    });
  });
});
