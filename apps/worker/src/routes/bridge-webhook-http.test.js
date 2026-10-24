import { describe, expect, it } from "vitest";
import { dispatchBridgeWebhookRoutes } from "./bridge-webhook-http.js";

function bridgeRow(over = {}) {
  return {
    id: "br-1",
    project_id: "p1",
    platform: "slack",
    name: "ops",
    token: null,
    token_ciphertext: null,
    token_iv: null,
    webhook_url: null,
    bot_user_id: null,
    bot_display_name: null,
    status: "connected",
    settings: null,
    signing_secret_ciphertext: null,
    signing_secret_iv: null,
    last_sync_at: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function createEnv(bridges) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(bridgeId) {
            return {
              first: async () => {
                const row = bridges[bridgeId] || null;
                if (!row) return null;
                if (sql.includes("signing_secret_ciphertext")) {
                  return {
                    settings: row.settings,
                    signing_secret_ciphertext: row.signing_secret_ciphertext,
                    signing_secret_iv: row.signing_secret_iv,
                  };
                }
                return row;
              },
              all: async () => ({ results: [] }),
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

function makeH(env) {
  return {
    env,
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
  };
}

function post(path, body, headers = {}) {
  return new Request(`https://worker.test${path}`, { method: "POST", body, headers });
}

async function call(request, env) {
  return dispatchBridgeWebhookRoutes(request, new URL(request.url), makeH(env));
}

async function slackSign(secret, timestamp, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${body}`));
  return `v0=${Buffer.from(new Uint8Array(mac)).toString("hex")}`;
}

describe("slack bridge webhook", () => {
  const secret = "test-signing-secret";

  it("returns 503 when no signing secret is configured", async () => {
    const env = createEnv({ "br-1": bridgeRow() });
    const res = await call(post("/webhooks/bridge/slack/br-1", "{}"), env);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "signature_not_configured" });
  });

  it("answers the url_verification challenge for a valid signature", async () => {
    const env = createEnv({
      "br-1": bridgeRow({ settings: JSON.stringify({ signingSecret: secret }) }),
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "url_verification", challenge: "c1" });
    const res = await call(
      post("/webhooks/bridge/slack/br-1", body, {
        "x-slack-request-timestamp": ts,
        "x-slack-signature": await slackSign(secret, ts, body),
      }),
      env,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ challenge: "c1" });
  });

  it("rejects a tampered body", async () => {
    const env = createEnv({
      "br-1": bridgeRow({ settings: JSON.stringify({ signingSecret: secret }) }),
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = await slackSign(secret, ts, "{}");
    const res = await call(
      post("/webhooks/bridge/slack/br-1", JSON.stringify({ injected: true }), {
        "x-slack-request-timestamp": ts,
        "x-slack-signature": signature,
      }),
      env,
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "bad_signature" });
  });

  it("rejects stale timestamps", async () => {
    const env = createEnv({
      "br-1": bridgeRow({ settings: JSON.stringify({ signingSecret: secret }) }),
    });
    const ts = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000));
    const body = "{}";
    const res = await call(
      post("/webhooks/bridge/slack/br-1", body, {
        "x-slack-request-timestamp": ts,
        "x-slack-signature": await slackSign(secret, ts, body),
      }),
      env,
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "stale_timestamp" });
  });

  it("keeps 404 for a discord bridge on the slack route", async () => {
    const env = createEnv({ "br-1": bridgeRow({ platform: "discord" }) });
    const res = await call(post("/webhooks/bridge/slack/br-1", "{}"), env);
    expect(res.status).toBe(404);
  });
});

describe("discord bridge webhook", () => {
  it("returns 503 when no public key is configured", async () => {
    const env = createEnv({ "br-2": bridgeRow({ id: "br-2", platform: "discord" }) });
    const res = await call(post("/webhooks/bridge/discord/br-2", "{}"), env);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "signature_not_configured" });
  });

  it("accepts a valid ed25519 signature", async () => {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const publicKey = Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))).toString("hex");
    const env = createEnv({
      "br-2": bridgeRow({
        id: "br-2",
        platform: "discord",
        settings: JSON.stringify({ publicKey }),
      }),
    });
    const timestamp = String(Date.now());
    const body = JSON.stringify({ type: 1 });
    const signature = Buffer.from(
      new Uint8Array(
        await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new TextEncoder().encode(timestamp + body)),
      ),
    ).toString("hex");
    const res = await call(
      post("/webhooks/bridge/discord/br-2", body, {
        "x-signature-timestamp": timestamp,
        "x-signature-ed25519": signature,
      }),
      env,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ignored: true });
  });

  it("rejects an invalid signature", async () => {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const publicKey = Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))).toString("hex");
    const env = createEnv({
      "br-2": bridgeRow({ id: "br-2", platform: "discord", settings: JSON.stringify({ publicKey }) }),
    });
    const res = await call(
      post("/webhooks/bridge/discord/br-2", "{}", {
        "x-signature-timestamp": String(Date.now()),
        "x-signature-ed25519": "00".repeat(64),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });
});
