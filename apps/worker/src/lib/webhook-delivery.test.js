import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deliverWebhooks,
  parseRetryAfterMs,
  processPendingWebhookDeliveries,
} from "./webhook-delivery.js";

vi.mock("./project-plan-quota.js", () => ({
  checkAndConsumeProjectQuota: vi.fn(async () => ({ allowed: true })),
}));

describe("parseRetryAfterMs", () => {
  it("parses delay-seconds and clamps to [1s, 1h]", () => {
    expect(parseRetryAfterMs("120")).toBe(120_000);
    expect(parseRetryAfterMs("0")).toBe(1_000);
    expect(parseRetryAfterMs("99999")).toBe(3_600_000);
  });

  it("parses HTTP-date values relative to now", () => {
    const now = Date.parse("2026-10-18T12:00:00.000Z");
    expect(parseRetryAfterMs("Sun, 18 Oct 2026 12:00:30 GMT", now)).toBe(30_000);
  });

  it("returns null for missing or unparsable values", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("")).toBeNull();
    expect(parseRetryAfterMs("soon")).toBeNull();
  });
});

function createEnv({ webhooks, deliveries }) {
  const env = {
    WEBHOOK_MAX_ATTEMPTS: "2",
    // Audit F-66: delivery now validates the operator host allowlist (env-aware).
    ALLOWED_SSRF_HOSTS: "hooks.example.com",
    DB: {
      prepare(sql) {
        const stmt = {
          params: [],
          bind(...params) {
            stmt.params = params;
            return stmt;
          },
          async all() {
            if (sql.includes("FROM webhooks WHERE project_id = ?")) {
              return {
                results: webhooks.filter((w) => w.project_id === stmt.params[0]),
              };
            }
            if (sql.includes("FROM webhook_deliveries WHERE")) {
              return { results: deliveries.filter((d) => d.status === "pending") };
            }
            if (sql.includes("FROM webhooks WHERE id IN")) {
              return { results: webhooks.filter((w) => stmt.params.includes(w.id)) };
            }
            return { results: [] };
          },
          async run() {
            if (sql.includes("INSERT INTO webhook_deliveries")) {
              const [id, project_id, webhook_id, webhook_url, event_type, payload] = stmt.params;
              deliveries.push({
                id,
                project_id,
                webhook_id,
                webhook_url,
                event_type,
                payload,
                status: "pending",
                attempt_count: 0,
              });
              return { meta: {} };
            }
            // Audit F-67: atomic claim — only a pending row can be claimed.
            if (sql.includes("SET status = 'processing'")) {
              const row = deliveries.find((d) => d.id === stmt.params[1]);
              if (!row || row.status !== "pending") return { meta: { changes: 0 } };
              row.status = "processing";
              return { meta: { changes: 1 } };
            }
            if (sql.includes("status = 'failed'")) {
              const row = deliveries.find((d) => d.id === stmt.params[stmt.params.length - 1]);
              if (row) row.status = "failed";
              return { meta: {} };
            }
            if (sql.includes("status = 'delivered'")) {
              const row = deliveries.find((d) => d.id === stmt.params[stmt.params.length - 1]);
              if (row) row.status = "delivered";
              return { meta: {} };
            }
            if (sql.includes("SET status = 'pending'")) {
              const row = deliveries.find((d) => d.id === stmt.params[stmt.params.length - 1]);
              if (row) {
                row.status = "pending";
                row.attempt_count = stmt.params[0];
                row.next_attempt_at = stmt.params[1];
              }
              return { meta: {} };
            }
            const row = deliveries.find((d) => d.id === stmt.params[stmt.params.length - 1]);
            if (row) row.attempt_count = stmt.params[0];
            return { meta: {} };
          },
        };
        return stmt;
      },
      async batch(statements) {
        for (const stmt of statements) await stmt.run();
      },
    },
  };
  return env;
}

describe("webhook error workflow (webhook.delivery_failed)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("notifies other hooks when a delivery exhausts retries, excluding the failing one", async () => {
    const webhooks = [
      { id: "wh_a", project_id: "p1", url: "https://hooks.example.com/a", event_types: "message.created" },
      { id: "wh_err", project_id: "p1", url: "https://hooks.example.com/err", event_types: "webhook.delivery_failed" },
    ];
    const deliveries = [
      {
        id: "d1",
        project_id: "p1",
        webhook_id: "wh_a",
        webhook_url: "https://hooks.example.com/a",
        event_type: "message.created",
        payload: JSON.stringify({ type: "message.created", projectId: "p1", payload: {} }),
        status: "pending",
        attempt_count: 1,
      },
    ];
    const env = createEnv({ webhooks, deliveries });
    const fetchMock = vi.fn(async (url) =>
      String(url).endsWith("/err")
        ? new Response("ok", { status: 200 })
        : new Response("boom", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await processPendingWebhookDeliveries(env);

    expect(deliveries[0].status).toBe("failed");
    const errorDelivery = deliveries.find((d) => d.event_type === "webhook.delivery_failed");
    expect(errorDelivery).toMatchObject({ webhook_id: "wh_err", status: "delivered" });
    expect(JSON.parse(errorDelivery.payload)).toMatchObject({
      type: "webhook.delivery_failed",
      projectId: "p1",
      payload: {
        deliveryId: "d1",
        webhookId: "wh_a",
        webhookUrl: "https://hooks.example.com/a",
        eventType: "message.created",
        attempts: 2,
        lastHttpStatus: 500,
        lastError: "http_500",
      },
    });
    // The failing hook never receives its own failure notice.
    expect(
      deliveries.some((d) => d.webhook_id === "wh_a" && d.event_type === "webhook.delivery_failed"),
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never re-notifies a failed webhook.delivery_failed delivery (no recursion)", async () => {
    const webhooks = [
      { id: "wh_err", project_id: "p1", url: "https://hooks.example.com/err", event_types: "webhook.delivery_failed" },
      { id: "wh_other", project_id: "p1", url: "https://hooks.example.com/other", event_types: "webhook.delivery_failed" },
    ];
    const deliveries = [
      {
        id: "d2",
        project_id: "p1",
        webhook_id: "wh_err",
        webhook_url: "https://hooks.example.com/err",
        event_type: "webhook.delivery_failed",
        payload: JSON.stringify({
          type: "webhook.delivery_failed",
          projectId: "p1",
          payload: { deliveryId: "d1" },
        }),
        status: "pending",
        attempt_count: 1,
      },
    ];
    const env = createEnv({ webhooks, deliveries });
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await processPendingWebhookDeliveries(env);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps retrying below max attempts without notifying", async () => {
    const webhooks = [
      { id: "wh_err", project_id: "p1", url: "https://hooks.example.com/err", event_types: "webhook.delivery_failed" },
    ];
    const deliveries = [
      {
        id: "d3",
        project_id: "p1",
        webhook_id: "wh_a",
        webhook_url: "https://hooks.example.com/a",
        event_type: "message.created",
        payload: JSON.stringify({ type: "message.created", projectId: "p1" }),
        status: "pending",
        attempt_count: 0,
      },
    ];
    const env = createEnv({ webhooks, deliveries });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    await processPendingWebhookDeliveries(env);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ status: "pending", attempt_count: 1 });
  });

  it("honors Retry-After when it exceeds the backoff schedule (capped at 1h)", async () => {
    const webhooks = [
      { id: "wh_a", project_id: "p1", url: "https://hooks.example.com/a", event_types: "message.created" },
    ];
    const deliveries = [
      {
        id: "d5",
        project_id: "p1",
        webhook_id: "wh_a",
        webhook_url: "https://hooks.example.com/a",
        event_type: "message.created",
        payload: JSON.stringify({ type: "message.created", projectId: "p1" }),
        status: "pending",
        attempt_count: 0,
      },
    ];
    const env = createEnv({ webhooks, deliveries });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 429, headers: { "retry-after": "7200" } })),
    );

    await processPendingWebhookDeliveries(env);

    expect(deliveries[0]).toMatchObject({ status: "pending", attempt_count: 1 });
    const delay = Date.parse(deliveries[0].next_attempt_at) - Date.now();
    expect(delay).toBeGreaterThan(3_500_000);
    expect(delay).toBeLessThanOrEqual(3_601_000);
  });

  it("keeps the scheduled delay when Retry-After is shorter", async () => {
    const webhooks = [
      { id: "wh_a", project_id: "p1", url: "https://hooks.example.com/a", event_types: "message.created" },
    ];
    const deliveries = [
      {
        id: "d6",
        project_id: "p1",
        webhook_id: "wh_a",
        webhook_url: "https://hooks.example.com/a",
        event_type: "message.created",
        payload: JSON.stringify({ type: "message.created", projectId: "p1" }),
        status: "pending",
        attempt_count: 0,
      },
    ];
    const env = createEnv({ webhooks, deliveries });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 429, headers: { "retry-after": "1" } })),
    );

    await processPendingWebhookDeliveries(env);

    const delay = Date.parse(deliveries[0].next_attempt_at) - Date.now();
    expect(delay).toBeGreaterThan(55_000);
    expect(delay).toBeLessThanOrEqual(61_000);
  });

  it("claims a row before sending so two processors do not double-deliver (audit F-67)", async () => {
    const webhooks = [
      { id: "wh_a", project_id: "p1", url: "https://hooks.example.com/a", event_types: "message.created" },
    ];
    const deliveries = [
      {
        id: "d4",
        project_id: "p1",
        webhook_id: "wh_a",
        webhook_url: "https://hooks.example.com/a",
        event_type: "message.created",
        payload: JSON.stringify({ type: "message.created", projectId: "p1" }),
        status: "pending",
        attempt_count: 0,
      },
    ];
    const env = createEnv({ webhooks, deliveries });
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = processPendingWebhookDeliveries(env);
    await Promise.resolve();
    await Promise.resolve();
    const second = processPendingWebhookDeliveries(env);
    await Promise.resolve();
    release();
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deliveries[0].status).toBe("delivered");
  });
});
