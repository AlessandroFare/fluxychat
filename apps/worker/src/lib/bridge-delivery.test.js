import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enqueueBridgeDelivery,
  enqueueRoomBridgeOutbound,
  processPendingBridgeDeliveries,
} from "./bridge-delivery.js";

function pick(map, sql) {
  for (const [key, value] of Object.entries(map)) {
    if (sql.includes(key)) return typeof value === "function" ? value() : value;
  }
  return undefined;
}

function createEnv({ all = {}, first = {}, env = {} } = {}) {
  const runs = [];
  return {
    env: {
      ...env,
      DB: {
        prepare(sql) {
          const stmt = {
            bind(...args) {
              return {
                first: async () => pick(first, sql) ?? null,
                all: async () => pick(all, sql) ?? { results: [] },
                run: async () => {
                  runs.push({ sql, args });
                  return { meta: { changes: 1 } };
                },
              };
            },
            first: async () => pick(first, sql) ?? null,
            all: async () => pick(all, sql) ?? { results: [] },
            run: async () => ({ meta: { changes: 1 } }),
          };
          return stmt;
        },
      },
    },
    runs,
  };
}

function deliveryRow(over = {}) {
  return {
    id: "bd_1",
    project_id: "p1",
    bridge_id: "br-1",
    fluxychat_message_id: "42",
    external_channel_id: "C1",
    payload: JSON.stringify({ content: "hello" }),
    status: "pending",
    attempt_count: 0,
    next_attempt_at: "2026-01-01T00:00:00Z",
    last_http_status: null,
    last_error: null,
    delivered_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function bridgeRow(over = {}) {
  return {
    id: "br-1",
    project_id: "p1",
    platform: "slack",
    token: "xoxb-1",
    token_ciphertext: null,
    token_iv: null,
    webhook_url: null,
    status: "connected",
    ...over,
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("processPendingBridgeDeliveries", () => {
  it("delivers a slack message with the bot token and records the map", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, ts: "111.222" }));
    vi.stubGlobal("fetch", fetchMock);
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow()] },
        "FROM bridge_configs": { results: [bridgeRow()] },
        "FROM messages": { results: [] },
      },
      first: { "FROM bridge_message_map": null },
    });

    const result = await processPendingBridgeDeliveries(env);
    expect(result.processed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.headers.Authorization).toBe("Bearer xoxb-1");
    expect(JSON.parse(init.body)).toEqual({ channel: "C1", text: "hello" });
    expect(runs.some((r) => r.sql.includes("status = 'delivered'"))).toBe(true);
    expect(runs.some((r) => r.sql.includes("INSERT INTO bridge_message_map"))).toBe(true);
    expect(runs.some((r) => r.sql.includes("SET last_sync_at"))).toBe(true);
  });

  it("schedules a retry with the provider error on failure", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, error: "channel_not_found" }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow()] },
        "FROM bridge_configs": { results: [bridgeRow()] },
        "FROM messages": { results: [] },
      },
      first: { "FROM bridge_message_map": null },
    });

    await processPendingBridgeDeliveries(env);
    const retry = runs.find((r) => r.sql.includes("next_attempt_at = ?"));
    expect(retry).toBeTruthy();
    expect(retry.args[3]).toBe("slack_channel_not_found");
    expect(retry.args[0]).toBe(1);
  });

  it("fails the delivery after the max attempts", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow({ attempt_count: 1 })] },
        "FROM bridge_configs": { results: [bridgeRow()] },
        "FROM messages": { results: [] },
      },
      first: { "FROM bridge_message_map": null },
      env: { BRIDGE_MAX_ATTEMPTS: "2" },
    });

    await processPendingBridgeDeliveries(env);
    expect(runs.some((r) => r.sql.includes("status = 'failed'"))).toBe(true);
    expect(runs.some((r) => r.sql.includes("SET error_message"))).toBe(true);
  });

  it("delivers to discord channels with Bot auth", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "msg-9" }, 200));
    vi.stubGlobal("fetch", fetchMock);
    const { env } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow({ bridge_id: "br-2" })] },
        "FROM bridge_configs": { results: [bridgeRow({ id: "br-2", platform: "discord", token: "tok-1" })] },
        "FROM messages": { results: [] },
      },
      first: { "FROM bridge_message_map": null },
    });

    await processPendingBridgeDeliveries(env);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/channels/C1/messages");
    expect(init.headers.Authorization).toBe("Bot tok-1");
  });

  it("skips messages that came from the same platform", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow()] },
        "FROM bridge_configs": { results: [bridgeRow()] },
        "FROM messages": { results: [{ id: 42, client_message_id: "slack_1712345678.000100" }] },
      },
      first: { "FROM bridge_message_map": null },
    });

    await processPendingBridgeDeliveries(env);
    expect(fetchMock).not.toHaveBeenCalled();
    const skipped = runs.find((r) => r.sql.includes("status = 'skipped'"));
    expect(skipped.args[0]).toBe("external_origin");
  });

  it("skips messages already mapped", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow()] },
        "FROM bridge_configs": { results: [bridgeRow()] },
        "FROM messages": { results: [] },
      },
      first: { "FROM bridge_message_map": { id: "bmm-1" } },
    });

    await processPendingBridgeDeliveries(env);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runs.find((r) => r.sql.includes("status = 'skipped'")).args[0]).toBe("already_synced");
  });

  it("retries when no delivery credentials are configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_deliveries": { results: [deliveryRow()] },
        "FROM bridge_configs": { results: [bridgeRow({ token: null })] },
        "FROM messages": { results: [] },
      },
      first: { "FROM bridge_message_map": null },
    });

    await processPendingBridgeDeliveries(env);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runs.find((r) => r.sql.includes("next_attempt_at = ?")).args[3]).toBe("no_delivery_credentials");
  });
});

describe("enqueueRoomBridgeOutbound", () => {
  it("queues one delivery per outbound mapping of a connected bridge", async () => {
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_channel_mappings": {
          results: [
            { bridge_id: "br-1", external_channel_id: "C1", sync_direction: "both" },
            { bridge_id: "br-1", external_channel_id: "C2", sync_direction: "outbound" },
            { bridge_id: "br-1", external_channel_id: "C3", sync_direction: "inbound" },
          ],
        },
        "FROM bridge_configs": { results: [{ id: "br-1", platform: "slack", status: "connected" }] },
      },
    });

    const result = await enqueueRoomBridgeOutbound(env, {
      projectId: "p1",
      roomId: "room-1",
      messageId: "42",
      content: "hello",
      clientMessageId: null,
    });
    expect(result.queued).toBe(2);
    const inserts = runs.filter((r) => r.sql.includes("INSERT INTO bridge_deliveries"));
    expect(inserts).toHaveLength(2);
    expect(inserts[0].args[4]).toBe("C1");
  });

  it("skips platform-scoped client ids and disconnected bridges", async () => {
    const { env, runs } = createEnv({
      all: {
        "FROM bridge_channel_mappings": {
          results: [{ bridge_id: "br-1", external_channel_id: "C1", sync_direction: "both" }],
        },
        "FROM bridge_configs": { results: [{ id: "br-1", platform: "slack", status: "connected" }] },
      },
    });

    const scoped = await enqueueRoomBridgeOutbound(env, {
      projectId: "p1",
      roomId: "room-1",
      messageId: "42",
      content: "hello",
      clientMessageId: "slack_1712345678.000100",
    });
    expect(scoped.queued).toBe(0);
    expect(runs.filter((r) => r.sql.includes("INSERT INTO bridge_deliveries"))).toHaveLength(0);

    const { env: env2 } = createEnv({
      all: {
        "FROM bridge_channel_mappings": {
          results: [{ bridge_id: "br-1", external_channel_id: "C1", sync_direction: "both" }],
        },
        "FROM bridge_configs": { results: [{ id: "br-1", platform: "slack", status: "disconnected" }] },
      },
    });
    const disconnected = await enqueueRoomBridgeOutbound(env2, {
      projectId: "p1",
      roomId: "room-1",
      messageId: "42",
      content: "hello",
      clientMessageId: null,
    });
    expect(disconnected.queued).toBe(0);
  });
});

describe("enqueueBridgeDelivery", () => {
  it("inserts a pending delivery row", async () => {
    const { env, runs } = createEnv();
    const { id } = await enqueueBridgeDelivery(env, {
      bridgeId: "br-1",
      projectId: "p1",
      fluxychatMessageId: "42",
      externalChannelId: "C1",
      content: "hello",
    });
    expect(id).toMatch(/^bd_/);
    const insert = runs.find((r) => r.sql.includes("INSERT INTO bridge_deliveries"));
    expect(insert).toBeTruthy();
    expect(insert.args[4]).toBe("C1");
  });
});
