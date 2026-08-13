import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/bridge.js", () => ({
  getBridgeConfig: vi.fn(),
  syncInboundMessage: vi.fn(),
  recordBridgeEvent: vi.fn(async () => ({})),
}));

vi.mock("../lib/matrix-bridge.js", () => ({
  getMatrixBridge: vi.fn(),
  processMatrixAppserviceTransaction: vi.fn(),
  recordMatrixSyncLog: vi.fn(async () => ({})),
  verifyMatrixAppserviceWebhook: vi.fn(),
}));

import { getBridgeConfig, syncInboundMessage } from "../lib/bridge.js";
import {
  getMatrixBridge,
  processMatrixAppserviceTransaction,
  verifyMatrixAppserviceWebhook,
} from "../lib/matrix-bridge.js";
import { dispatchBridgeWebhookRoutes } from "../routes/bridge-webhook-http.js";
import {
  assertFixtureExpectations,
  listWebhookFixtures,
  loadWebhookFixture,
  replayWebhookFixture,
  listFrameRecordings,
  loadFrameRecording,
  replayFrameRecording,
  assertFrameExpectations,
} from "./integration-emulator.js";
import {
  parseDiscordWebhookBody,
  parseSlackWebhookBody,
  summarizeMatrixTransaction,
} from "./bridge-webhook-parsers.js";

const routeDeps = {
  env: {},
  json: (body, init = {}) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    }),
  corsHeaders: {},
};

beforeEach(() => {
  vi.mocked(getBridgeConfig).mockReset();
  vi.mocked(syncInboundMessage).mockReset();
  vi.mocked(getMatrixBridge).mockReset();
  vi.mocked(processMatrixAppserviceTransaction).mockReset();
  vi.mocked(verifyMatrixAppserviceWebhook).mockReset();

  vi.mocked(syncInboundMessage).mockResolvedValue({ synced: true, messageId: "fc_1" });
  vi.mocked(getBridgeConfig).mockImplementation(async (_env, { bridgeId }) => {
    if (bridgeId === "br_slack_fixture") {
      return { id: bridgeId, projectId: "p1", platform: "slack" };
    }
    if (bridgeId === "br_discord_fixture") {
      return { id: bridgeId, projectId: "p1", platform: "discord" };
    }
    return null;
  });
  vi.mocked(getMatrixBridge).mockResolvedValue({
    id: "mb_fixture",
    projectId: "p1",
  });
  vi.mocked(verifyMatrixAppserviceWebhook).mockResolvedValue({ ok: true });
  vi.mocked(processMatrixAppserviceTransaction).mockResolvedValue({
    processed: [{ eventId: "$fixture_event_1" }],
    ignored: [],
  });
});

describe("bridge-webhook-parsers", () => {
  it("parses Slack message fixture payload", () => {
    const fixture = loadWebhookFixture("slack-message");
    const parsed = parseSlackWebhookBody(fixture.payload);
    expect(parsed.kind).toBe("message");
    expect(parsed.content).toContain("Slack replay fixture");
  });

  it("parses Discord message fixture payload", () => {
    const fixture = loadWebhookFixture("discord-message");
    const parsed = parseDiscordWebhookBody(fixture.payload);
    expect(parsed.kind).toBe("message");
    expect(parsed.externalUsername).toBe("fixture-user");
  });

  it("summarizes Matrix transaction fixture", () => {
    const fixture = loadWebhookFixture("matrix-transaction");
    const summary = summarizeMatrixTransaction(fixture.payload);
    expect(summary.messageCount).toBe(1);
  });
});

describe("integration-emulator replay", () => {
  it("lists bundled webhook fixtures", () => {
    const names = listWebhookFixtures();
    expect(names).toContain("slack-message");
    expect(names).toContain("discord-message");
    expect(names).toContain("matrix-transaction");
  });

  for (const name of [
    "slack-url-verification",
    "slack-message",
    "slack-bot-message-ignored",
    "discord-message",
    "matrix-transaction",
  ]) {
    it(`replays fixture ${name}`, async () => {
      const fixture = loadWebhookFixture(name);
      const result = await replayWebhookFixture(
        dispatchBridgeWebhookRoutes,
        {},
        routeDeps,
        fixture,
      );
      expect(() => assertFixtureExpectations(fixture, result)).not.toThrow();
      expect(result.status).toBe(fixture.expect.status ?? 200);
    });
  }
});

describe("integration-emulator frame recordings", () => {
  it("lists frame recordings", () => {
    const names = listFrameRecordings();
    expect(names).toContain("room-connect-history");
  });

  it("replays room-connect-history frames", () => {
    const recording = loadFrameRecording("room-connect-history");
    const result = replayFrameRecording(recording);
    expect(() => assertFrameExpectations(recording, result)).not.toThrow();
    expect(result.eventTypes).toHaveLength(recording.frames.length);
  });
});
