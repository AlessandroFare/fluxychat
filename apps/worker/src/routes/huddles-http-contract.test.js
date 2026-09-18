/**
 * Phase 4 huddles (labs): Realtime SFU HTTP fail-closed without secrets + budget 429.
 */
import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchRealtimeSfuRoutes } from "./realtime-sfu-http.js";
import { monthUtcKey } from "../lib/huddle-sfu-budget.js";

const memberJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["member"],
});

function huddleDb({ member = true, open = [], bytesUsed = 0 } = {}) {
  const meter = { month_utc: monthUtcKey(), bytes_used: bytesUsed };
  return {
    prepare(sql) {
      const exec = {
        first: async () => {
          if (String(sql).includes("room_members")) return member ? { ok: 1 } : null;
          if (String(sql).includes("FROM rooms")) return member ? { id: "room-1", type: "public" } : null;
          if (String(sql).includes("FROM huddle_sfu_open") && String(sql).includes("COUNT")) {
            return { n: open.length };
          }
          if (String(sql).includes("FROM huddle_sfu_meter")) return meter;
          return null;
        },
        all: async () => ({ results: open.slice() }),
        run: async () => ({ success: true, meta: { changes: 1 } }),
      };
      return {
        bind() {
          return exec;
        },
        ...exec,
      };
    },
  };
}

function deps(opts = {}) {
  const db = huddleDb(opts);
  const env = {
    DB: db,
    RATE_LIMIT_FALLBACK_ALLOW: opts.hourlyDeny ? undefined : "true",
    RATE_LIMIT_KV: opts.hourlyDeny
      ? { get: async () => "20", put: async () => {} }
      : undefined,
    REALTIME_SFU_APP_ID: opts.configured === false ? "" : "app",
    REALTIME_SFU_APP_SECRET: opts.configured === false ? "" : "sec",
    REALTIME_SFU_DISABLED: opts.disabled,
    REALTIME_SFU_ALLOW_VIDEO: opts.allowVideo,
    REALTIME_SFU_MONTHLY_GB_CAP: opts.monthlyGb,
    REALTIME_SFU_MAX_CONCURRENT: opts.concurrent,
  };
  return createAuthMatrixDeps({
    db,
    verifyJwt: opts.anon ? undefined : memberJwt,
    extra: { env },
  });
}

function req(path, { method = "GET", body } = {}) {
  return unauthorizedRequest(path, { method, body });
}

describe("huddles Realtime SFU HTTP", () => {
  it("POST /rooms/:id/realtime/sessions without JWT is 401", async () => {
    const request = req("/rooms/room-1/realtime/sessions", { method: "POST", body: {} });
    const res = await dispatchRealtimeSfuRoutes(request, new URL(request.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET budget without room membership is 403", async () => {
    const request = req("/rooms/room-1/realtime/budget");
    const res = await dispatchRealtimeSfuRoutes(request, new URL(request.url), deps({ member: false }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("GET budget without SFU secrets is 503 realtime_sfu_not_configured", async () => {
    const request = req("/rooms/room-1/realtime/budget");
    const res = await dispatchRealtimeSfuRoutes(
      request,
      new URL(request.url),
      deps({ configured: false }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("realtime_sfu_not_configured");
  });

  it("GET budget with secrets returns an estimate snapshot", async () => {
    const request = req("/rooms/room-1/realtime/budget");
    const res = await dispatchRealtimeSfuRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estimated).toBe(true);
    expect(body.disabled).toBe(false);
    expect(body.allowVideo).toBe(false);
  });

  it("POST sessions with a missing SDP offer is 400", async () => {
    const request = req("/rooms/room-1/realtime/sessions", { method: "POST", body: {} });
    const res = await dispatchRealtimeSfuRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_payload");
  });

  it("POST sessions over the hourly flood cap is 429 hourly", async () => {
    const request = req("/rooms/room-1/realtime/sessions", { method: "POST", body: {} });
    const res = await dispatchRealtimeSfuRoutes(
      request,
      new URL(request.url),
      deps({ hourlyDeny: true }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.reason).toBe("hourly");
  });

  it("POST sessions when the monthly GB estimate is exhausted is 429 monthly_gb", async () => {
    const request = req("/rooms/room-1/realtime/sessions", { method: "POST", body: {} });
    const res = await dispatchRealtimeSfuRoutes(
      request,
      new URL(request.url),
      deps({ monthlyGb: 1, bytesUsed: 2e9 }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.reason).toBe("monthly_gb");
  });

  it("POST sessions when too many huddles are open is 429 concurrent", async () => {
    const request = req("/rooms/room-1/realtime/sessions", { method: "POST", body: {} });
    const res = await dispatchRealtimeSfuRoutes(
      request,
      new URL(request.url),
      deps({
        concurrent: 1,
        open: [
          {
            session_id: "ses_a",
            started_at: new Date().toISOString(),
            has_video: 0,
          },
        ],
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.reason).toBe("concurrent");
  });

  it("POST sessions with the kill switch is 429 disabled", async () => {
    const request = req("/rooms/room-1/realtime/sessions", { method: "POST", body: {} });
    const res = await dispatchRealtimeSfuRoutes(
      request,
      new URL(request.url),
      deps({ disabled: "true" }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.reason).toBe("disabled");
  });

  it("POST room tracks with video while video is off is 429 video_disabled", async () => {
    const request = req("/rooms/room-1/realtime/tracks", {
      method: "POST",
      body: { sessionId: "ses_1", tracks: [{ kind: "video", location: "local" }] },
    });
    const res = await dispatchRealtimeSfuRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.reason).toBe("video_disabled");
  });
});
