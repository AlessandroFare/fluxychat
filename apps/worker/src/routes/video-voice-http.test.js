/**
 * Audit F-26: video token minting must bind to a real call of the project and
 * to the authenticated user; identity, room name and TTL are server-decided.
 */
import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchVideoVoiceRoutes } from "./video-voice-http.js";
import { clampLiveKitTtl, LIVEKIT_TTL_MAX_SECONDS, LIVEKIT_TTL_MIN_SECONDS } from "../lib/livekit-token.js";

function jsonReq(path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request(`http://127.0.0.1:8787${path}`, init);
}

const memberJwt = async () => ({ userId: "u1", projectId: "p1", roles: ["member"] });

function callRow(overrides = {}) {
  return {
    id: "call_1",
    project_id: "p1",
    room_id: "r1",
    provider: "daily",
    provider_room_id: "provider-room-1",
    status: "active",
    started_by: "u0",
    started_at: null,
    ended_at: null,
    duration_ms: null,
    recording_enabled: 0,
    recording_url: null,
    max_participants: null,
    settings: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function deps({ call = callRow(), denyRoom = false } = {}) {
  return createAuthMatrixDeps({
    verifyJwt: memberJwt,
    db: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                return String(sql).includes("FROM call_sessions") ? call : null;
              },
              async all() {
                return String(sql).includes("FROM call_sessions")
                  ? { results: call ? [call] : [] }
                  : { results: [] };
              },
              async run() {
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    extra: { canAccessRoom: async () => !denyRoom },
  });
}

describe("clampLiveKitTtl (audit F-26)", () => {
  it("bounds the requested ttl", () => {
    expect(clampLiveKitTtl(3600)).toBe(3600);
    expect(clampLiveKitTtl(31536000)).toBe(LIVEKIT_TTL_MAX_SECONDS);
    expect(clampLiveKitTtl(1)).toBe(LIVEKIT_TTL_MIN_SECONDS);
    expect(clampLiveKitTtl(undefined)).toBe(3600);
    expect(clampLiveKitTtl(-5)).toBe(3600);
  });
});

describe("POST /admin/calls/token binding (audit F-26)", () => {
  it("ignores body.userId and mints for the authenticated user", async () => {
    const req = jsonReq("/admin/calls/token", {
      method: "POST",
      body: { callId: "call_1", provider: "daily", userId: "victim", ttl: 31536000 },
    });
    const res = await dispatchVideoVoiceRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect(token.payload.sub).toBe("u1");
    const now = Math.floor(Date.now() / 1000);
    expect(token.payload.exp).toBeLessThanOrEqual(now + LIVEKIT_TTL_MAX_SECONDS + 5);
    expect(token.payload.exp).toBeGreaterThanOrEqual(now + LIVEKIT_TTL_MAX_SECONDS - 5);
  });

  it("binds the room to the stored call, not the request body", async () => {
    const req = jsonReq("/admin/calls/token", {
      method: "POST",
      body: { callId: "call_1", provider: "daily", roomId: "attacker-room", roomName: "evil" },
    });
    const res = await dispatchVideoVoiceRoutes(req, new URL(req.url), deps());
    const { token } = await res.json();
    expect(token.payload.room).toBe("r1");
  });

  it("404s when no call of the project matches", async () => {
    const req = jsonReq("/admin/calls/token", {
      method: "POST",
      body: { roomId: "r-other", provider: "daily" },
    });
    const res = await dispatchVideoVoiceRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("call_not_found");
  });

  it("403s when the caller cannot access the call room", async () => {
    const req = jsonReq("/admin/calls/token", {
      method: "POST",
      body: { callId: "call_1", provider: "daily" },
    });
    const res = await dispatchVideoVoiceRoutes(req, new URL(req.url), deps({ denyRoom: true }));
    expect(res.status).toBe(403);
  });
});
