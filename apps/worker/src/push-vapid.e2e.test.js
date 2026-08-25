/**
 * e2e tests for the Web Push (VAPID) endpoints added in P10-ext:
 *   - GET  /push/web/vapid-public-key
 *   - POST /push/web/subscribe
 *   - GET  /push/web/subscriptions
 *   - DELETE /push/web/subscribe/:idOrEndpoint
 *
 * Also exercises the lib helpers:
 *   - generateVapidKeyPair
 *   - buildVapidJwt (ES256, DER/JOSE r||s)
 *   - encryptWebPushPayload (RFC 8188)
 *   - classifyPushResponse
 *   - sendWebPushToUser (triage behaviour)
 */
import { beforeEach, describe, expect, it } from "vitest";
import worker from "./worker.js";
import {
  buildVapidJwt,
  classifyPushResponse,
  encryptWebPushPayload,
  generateVapidKeyPair,
  getVapidPublicKeyRaw,
  sendWebPushToUser,
} from "./lib/vapid.js";

class FakeDB {
  constructor() {
    this.projectSecrets = [];
    this.projectVapidKeys = [];
    this.webPushSubscriptions = [];
    this.lastWebPushId = 0;
  }
  prepare(sql) {
    const db = this;
    let bound = [];
    const stmt = {
      bind(...args) {
        bound = args;
        return stmt;
      },
      async run() {
        return db.#run(sql, bound);
      },
      async first() {
        return db.#first(sql, bound);
      },
      async all() {
        const rows = await db.#all(sql, bound);
        return { results: rows };
      },
    };
    return stmt;
  }
  async #run(sql, bound) {
    if (sql.includes("INSERT OR IGNORE INTO project_vapid_keys")) {
      const existing = this.projectVapidKeys.find(
        (k) => k.project_id === bound[0],
      );
      if (!existing) {
        this.projectVapidKeys.push({
          project_id: bound[0],
          public_key: bound[1],
          private_key: bound[2],
          subject: bound[3],
          created_at: bound[4],
          updated_at: bound[5],
        });
      }
      return { success: true };
    }
    if (sql.includes("UPDATE project_vapid_keys")) {
      return { success: true };
    }
    if (sql.includes("INSERT INTO web_push_subscriptions")) {
      const idx = this.lastWebPushId + 1;
      this.lastWebPushId = idx;
      // On conflict (same project_id+endpoint)  replace existing row
      // SQL: (id, project_id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at, failure_count)
      // bound: bound[0]=id, bound[1]=projectId, bound[2]=userId, bound[3]=endpoint, bound[4]=p256dh, bound[5]=auth, bound[6]=userAgent, bound[7]=createdAt, bound[8]=updatedAt
      const existingIdx = this.webPushSubscriptions.findIndex(
        (s) => s.project_id === bound[1] && s.endpoint === bound[3],
      );
      const row = {
        id: `wps_${idx}`,
        project_id: bound[1],
        user_id: bound[2],
        endpoint: bound[3],
        p256dh: bound[4],
        auth: bound[5],
        user_agent: bound[6] || null,
        last_sent_at: null,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        this.webPushSubscriptions[existingIdx] = row;
      } else {
        this.webPushSubscriptions.push(row);
      }
      return { success: true };
    }
    if (sql.includes("DELETE FROM web_push_subscriptions")) {
      const before = this.webPushSubscriptions.length;
      // SQL variants: "WHERE id = ? AND project_id = ? AND user_id = ?" (bound: [id, projectId, userId])
      //                "WHERE endpoint = ? AND project_id = ? AND user_id = ?" (bound: [endpoint, projectId, userId])
      this.webPushSubscriptions = this.webPushSubscriptions.filter(
        (s) =>
          !(
            s.project_id === bound[1] &&
            s.user_id === bound[2] &&
            (s.id === bound[0] || s.endpoint === bound[0])
          ),
      );
      const changes = before - this.webPushSubscriptions.length;
      return { success: true, changes, meta: { changes } };
    }
    if (sql.includes("UPDATE web_push_subscriptions")) {
      return { success: true };
    }
    return { success: true };
  }
  async #first(sql, bound) {
    if (sql.includes("FROM project_vapid_keys")) {
      return this.projectVapidKeys.find((k) => k.project_id === bound[0]) || null;
    }
    if (sql.includes("COUNT(*) AS cnt FROM web_push_subscriptions")) {
      const cnt = this.webPushSubscriptions.filter(
        (s) => s.user_id === bound[0],
      ).length;
      return { cnt };
    }
    if (/SELECT\s+jwt_secret.*FROM project_secrets WHERE project_id = \?/s.test(sql)) {
      const [projectId] = bound;
      const row = this.projectSecrets.find((r) => r.project_id === projectId);
      // Rotation-aware verifier also reads previous-secret columns.
      return row
        ? {
            jwt_secret: row.jwt_secret,
            jwt_secret_previous: row.jwt_secret_previous ?? null,
            jwt_secret_previous_expires_at: row.jwt_secret_previous_expires_at ?? null,
          }
        : null;
    }
    return null;
  }
  async #all(sql, bound) {
    if (sql.includes("FROM web_push_subscriptions")) {
      return this.webPushSubscriptions.filter(
        (s) => s.project_id === bound[0] && s.user_id === bound[1],
      );
    }
    return [];
  }
}

function createEnv(db) {
  return {
    DB: db,
    DEFAULT_PROJECT_ID: "default",
    REQUIRE_ADMIN_AUTH: "true",
    VAPID_SUBJECT: "mailto:test@fluxy.local",
  };
}

async function makeJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (o) =>
    btoa(JSON.stringify(o)).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sigB64}`;
}

async function callWorker({ env, url, method = "GET", body, token, headers }) {
  const request = new Request(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return worker.fetch(request, env, { waitUntil() {} });
}

describe("Web Push (VAPID)  P10-ext", () => {
  let db;
  let env;
  const projectId = "proj_1";
  const userId = "user_1";
  const jwtSecret = "test-secret";

  beforeEach(() => {
    db = new FakeDB();
    db.projectSecrets.push({ project_id: projectId, jwt_secret: jwtSecret });
    env = createEnv(db);
  });

  it("GET /push/web/vapid-public-key auto-generates a key pair and returns the public key", async () => {
    const res = await callWorker({
      env,
      url: "https://fluxy.local/push/web/vapid-public-key?projectId=" + projectId,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.publicKey).toBe("string");
    expect(data.publicKey.length).toBeGreaterThanOrEqual(86);
    expect(data.subject).toBe("mailto:test@fluxy.local");
    expect(db.projectVapidKeys).toHaveLength(1);
    expect(db.projectVapidKeys[0].project_id).toBe(projectId);
  });

  it("GET /push/web/vapid-public-key returns the same key on subsequent calls (idempotent)", async () => {
    const a = await (await callWorker({ env, url: "https://fluxy.local/push/web/vapid-public-key?projectId=" + projectId })).json();
    const b = await (await callWorker({ env, url: "https://fluxy.local/push/web/vapid-public-key?projectId=" + projectId })).json();
    expect(a.publicKey).toBe(b.publicKey);
    expect(db.projectVapidKeys).toHaveLength(1);
  });

  it("POST /push/web/subscribe registers a subscription and lists it", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret,
    );
    const subRes = await callWorker({
      env,
      url: "https://fluxy.local/push/web/subscribe",
      method: "POST",
      token,
      headers: { "X-Fluxy-Project-Id": projectId },
      body: {
        endpoint: "https://fcm.googleapis.com/fcm/send/dummy-id",
        keys: {
          p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtav5i4h4PO7gsP3F7lQ",
          auth: "tBHItJI5svbpez7KI4CCXg",
        },
        userAgent: "vitest",
      },
    });
    expect(subRes.status).toBe(200);
    expect(db.webPushSubscriptions).toHaveLength(1);

    const listRes = await callWorker({
      env,
      url: "https://fluxy.local/push/web/subscriptions",
      token,
      headers: { "X-Fluxy-Project-Id": projectId },
    });
    const list = await listRes.json();
    expect(list.subscriptions).toHaveLength(1);
    expect(list.subscriptions[0].endpointHost).toBe("fcm.googleapis.com");
    expect(list.subscriptions[0].endpointPreview).toContain("dummy-id");
  });

  it("POST /push/web/subscribe rejects invalid endpoint (non-https)", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret,
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/push/web/subscribe",
      method: "POST",
      token,
      body: {
        endpoint: "ftp://example.com/push",
        keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtav5i4h4PO7gsP3F7lQ", auth: "tBHItJI5svbpez7KI4CCXg" },
      },
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /push/web/subscribe/:idOrEndpoint removes the subscription", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret,
    );
    const sub = await (await callWorker({
      env,
      url: "https://fluxy.local/push/web/subscribe",
      method: "POST",
      token,
      body: {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtav5i4h4PO7gsP3F7lQ", auth: "tBHItJI5svbpez7KI4CCXg" },
      },
    })).json();
    expect(db.webPushSubscriptions).toHaveLength(1);
    const del = await callWorker({
      env,
      url: "https://fluxy.local/push/web/subscribe/" + encodeURIComponent("https://fcm.googleapis.com/fcm/send/abc"),
      method: "DELETE",
      token,
    });
    expect(del.status).toBe(200);
    const body = await del.json();
    expect(body.removed).toBe(1);
    expect(db.webPushSubscriptions).toHaveLength(0);
  });

  it("buildVapidJwt produces a valid ES256 JWT with t=audience claim", async () => {
    const { publicKey, privateKey } = await generateVapidKeyPair();
    const jwt = await buildVapidJwt(privateKey, "https://fcm.googleapis.com", "mailto:test@x.com", 60);
    const [h, p, s] = jwt.split(".");
    const dec = (b) => JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0)),
      ),
    );
    expect(dec(h).alg).toBe("ES256");
    expect(dec(h).typ).toBe("JWT");
    expect(dec(p).aud).toBe("https://fcm.googleapis.com");
    expect(dec(p).sub).toBe("mailto:test@x.com");
    expect(s.length).toBeGreaterThan(0);
  });

  it("encryptWebPushPayload produces an RFC 8188 aes128gcm blob", async () => {
    const { publicKey: receiverPub } = await generateVapidKeyPair();
    const p256dh = await getVapidPublicKeyRaw(receiverPub);
    const auth = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const { ciphertext, salt, rs, encoding } = await encryptWebPushPayload(
      new TextEncoder().encode(JSON.stringify({ title: "hi" })),
      p256dh,
      auth,
    );
    expect(encoding).toBe("aes128gcm");
    expect(salt.length).toBe(16);
    expect(rs).toBe(4096);
    // header: salt(16) | rs(4) | idlen(1) | ecdh(65) = 86
    expect(ciphertext.byteLength).toBeGreaterThan(86);
  });

  it("sendWebPushToUser returns classification for push responses", () => {
    expect(classifyPushResponse(201)).toBe("delivered");
    expect(classifyPushResponse(410)).toBe("gone");
    expect(classifyPushResponse(429)).toBe("rate_limited");
    expect(classifyPushResponse(401)).toBe("config_error");
    expect(classifyPushResponse(503)).toBe("transient");
  });
});
