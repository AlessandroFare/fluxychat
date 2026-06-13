import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  evaluateOperationalAlerts,
  dispatchOperationalAlertEvent,
} from "./operational-alerts.js";

function createMockDb(state = {}) {
  const {
    rules = [],
    metrics = [],
    openEvents = [],
    dispatches = [],
  } = state;

  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("operational_alert_rules")) {
                return { results: rules };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes("operational_metrics")) {
                const [projectId, metricName] = args;
                const total = metrics
                  .filter(
                    (m) =>
                      m.project_id === projectId && m.metric_name === metricName
                  )
                  .reduce((sum, m) => sum + Number(m.metric_value || 0), 0);
                return { total };
              }
              if (sql.includes("operational_alert_events")) {
                const [ruleId] = args;
                return openEvents.find((e) => e.rule_id === ruleId) || null;
              }
              if (sql.includes("operational_alert_dispatches")) {
                const [id] = args;
                return dispatches.find((d) => d.id === id) || null;
              }
              return null;
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

describe("operational-alerts", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "alert-event-uuid",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns zero when projectId is missing", async () => {
    const result = await evaluateOperationalAlerts({ DB: createMockDb() }, null);
    expect(result).toEqual({ checkedRules: 0, triggered: 0 });
  });

  it("triggers alert when metric crosses gte threshold", async () => {
    const env = {
      DB: createMockDb({
        rules: [
          {
            id: "rule_1",
            metric_name: "messages_created",
            window_minutes: 5,
            threshold_value: 100,
            comparator: "gte",
            severity: "warning",
            cooldown_minutes: 15,
          },
        ],
        metrics: [
          {
            project_id: "proj_1",
            metric_name: "messages_created",
            metric_value: 120,
          },
        ],
      }),
    };

    const result = await evaluateOperationalAlerts(env, "proj_1");
    expect(result).toEqual({ checkedRules: 1, triggered: 1 });
  });

  it("skips trigger when metric is below threshold", async () => {
    const env = {
      DB: createMockDb({
        rules: [
          {
            id: "rule_1",
            metric_name: "messages_created",
            window_minutes: 5,
            threshold_value: 100,
            comparator: "gte",
            severity: "warning",
            cooldown_minutes: 15,
          },
        ],
        metrics: [
          {
            project_id: "proj_1",
            metric_name: "messages_created",
            metric_value: 40,
          },
        ],
      }),
    };

    const result = await evaluateOperationalAlerts(env, "proj_1");
    expect(result).toEqual({ checkedRules: 1, triggered: 0 });
  });

  it("dispatches webhook when ALERT_DISPATCH_WEBHOOK_URL is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      ALERT_DISPATCH_WEBHOOK_URL: "https://hooks.example.com/alerts",
      DB: createMockDb({ dispatches: [] }),
    };

    await dispatchOperationalAlertEvent(env, {
      id: "evt_1",
      projectId: "proj_1",
      ruleId: "rule_1",
      metricName: "messages_created",
      observedValue: 200,
      thresholdValue: 100,
      severity: "critical",
      message: "messages_created gte 100 (observed 200 in 5m)",
      createdAt: "2026-05-28T12:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/alerts");
    expect(init.headers["X-Fluxy-Event"]).toBe("operational.alert.triggered");
    const body = JSON.parse(init.body);
    expect(body.alert.metricName).toBe("messages_created");
    expect(body.alert.observedValue).toBe(200);
  });

  it("no-ops dispatch when webhook URL is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await dispatchOperationalAlertEvent(
      { DB: createMockDb(), ALERT_DISPATCH_WEBHOOK_URL: "" },
      {
        id: "evt_1",
        projectId: "proj_1",
        ruleId: "rule_1",
        metricName: "x",
        observedValue: 1,
        thresholdValue: 0,
        severity: "info",
        message: "test",
        createdAt: "2026-05-28T12:00:00.000Z",
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
