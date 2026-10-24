import { beforeAll, describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/bridge.js", () => ({
  getBridgeConfig: vi.fn(),
  getBridgeSigningSecret: vi.fn(),
  syncInboundMessage: vi.fn(),
  recordBridgeEvent: vi.fn(async () => ({})),
}));

vi.mock("../lib/matrix-bridge.js", () => ({
  getMatrixBridge: vi.fn(),
  processMatrixAppserviceTransaction: vi.fn(),
  recordMatrixSyncLog: vi.fn(async () => ({})),
  verifyMatrixAppserviceWebhook: vi.fn(),
}));

import { getBridgeConfig, getBridgeSigningSecret, syncInboundMessage } from "../lib/bridge.js";
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

const SLACK_FIXTURE_SECRET = "fixture-signing-secret";
let discordKeyPair = null;
let discordPublicKeyHex = "";

beforeAll(async () => {
  discordKeyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  discordPublicKeyHex = Buffer.from(
    new Uint8Array(await crypto.subtle.exportKey("raw", discordKeyPair.publicKey)),
  ).toString("hex");
});

async function signedHeadersFor(fixture) {
  const body =
    typeof fixture.payload === "string" ? fixture.payload : JSON.stringify(fixture.payload);
  if (fixture.platform === "slack") {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SLACK_FIXTURE_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`v0:${timestamp}:${body}`),
    );
    return {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${Buffer.from(new Uint8Array(mac)).toString("hex")}`,
    };
  }
  if (fixture.platform === "discord") {
    const timestamp = String(Date.now());
    const signature = Buffer.from(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "Ed25519" },
          discordKeyPair.privateKey,
          new TextEncoder().encode(timestamp + body),
        ),
      ),
    ).toString("hex");
    return { "x-signature-timestamp": timestamp, "x-signature-ed25519": signature };
  }
  return {};
}

beforeEach(() => {
  vi.mocked(getBridgeConfig).mockReset();
  vi.mocked(getBridgeSigningSecret).mockReset();
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
  vi.mocked(getBridgeSigningSecret).mockImplementation(async (_env, { bridgeId }) => {
    if (bridgeId === "br_slack_fixture") return SLACK_FIXTURE_SECRET;
    if (bridgeId === "br_discord_fixture") return discordPublicKeyHex;
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
        { headers: await signedHeadersFor(fixture) },
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
