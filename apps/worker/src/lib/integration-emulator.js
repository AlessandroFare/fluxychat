/**
 * CP-064: Integration test emulators — load webhook fixtures and replay against routes.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "webhooks",
);

/**
 * @param {string} name Fixture basename without .json (e.g. "slack-message")
 */
export function loadWebhookFixture(name) {
  const filePath = join(FIXTURES_DIR, `${name}.json`);
  const raw = readFileSync(filePath, "utf8");
  const doc = JSON.parse(raw);
  return {
    name: doc.name || name,
    platform: doc.platform,
    bridgeId: doc.bridgeId || "br_fixture",
    payload: doc.payload,
    headers: doc.headers || {},
    expect: doc.expect || {},
  };
}

/** @returns {string[]} */
export function listWebhookFixtures() {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

/**
 * @param {"slack"|"discord"|"matrix"} platform
 * @param {string} bridgeId
 * @param {unknown} body
 * @param {{ headers?: Record<string, string> }} [options]
 */
export function createBridgeWebhookRequest(platform, bridgeId, body, options = {}) {
  const encoded = encodeURIComponent(bridgeId);
  const path =
    platform === "matrix"
      ? `/webhooks/matrix/${encoded}`
      : `/webhooks/bridge/${platform}/${encoded}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/**
 * Replay a fixture through a route dispatcher (e.g. dispatchBridgeWebhookRoutes).
 * @param {(request: Request, url: URL, h: object) => Promise<Response|null>} dispatchFn
 * @param {*} env
 * @param {object} h Route deps bag
 * @param {ReturnType<typeof loadWebhookFixture>} fixture
 */
export async function replayWebhookFixture(dispatchFn, env, h, fixture) {
  const request = createBridgeWebhookRequest(
    fixture.platform,
    fixture.bridgeId,
    fixture.payload,
    { headers: fixture.headers },
  );
  const url = new URL(request.url);
  const response = await dispatchFn(request, url, h);
  if (!response) {
    return { status: 404, body: { error: "no_route" } };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

export {
  loadFrameRecording,
  listFrameRecordings,
  replayFrameRecording,
  assertFrameExpectations as assertFrameExpectations,
  FRAMES_DIR,
} from "./frame-replay.js";

/**
 * @param {ReturnType<typeof loadWebhookFixture>} fixture
 * @param {{ status: number, body: unknown }} result
 */
export function assertFixtureExpectations(fixture, result) {
  const expect = fixture.expect || {};
  if (expect.status !== undefined && result.status !== expect.status) {
    throw new Error(
      `fixture ${fixture.name}: expected status ${expect.status}, got ${result.status}`,
    );
  }
  if (expect.ok !== undefined && result.body?.ok !== expect.ok) {
    throw new Error(
      `fixture ${fixture.name}: expected ok=${expect.ok}, got ${JSON.stringify(result.body)}`,
    );
  }
  if (expect.challenge !== undefined && result.body?.challenge !== expect.challenge) {
    throw new Error(`fixture ${fixture.name}: challenge mismatch`);
  }
  if (expect.ignored !== undefined && result.body?.ignored !== expect.ignored) {
    throw new Error(`fixture ${fixture.name}: expected ignored=${expect.ignored}`);
  }
  return true;
}
