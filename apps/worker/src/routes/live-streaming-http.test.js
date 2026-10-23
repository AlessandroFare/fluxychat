/**
 * Live streaming route happy paths + status mapping.
 * The libs (`live-streaming`, `live-stream-commerce`, `live-stream-replay`) are
 * unit-tested on fake D1; this file locks the HTTP layer: dispatch, member auth
 * gate, arg mapping and error → status codes. The auth guard and the
 * `withAuthProjectId` helper are imported for real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchLiveStreamingRoutes } from "./live-streaming-http.js";
import * as Live from "../lib/live-streaming.js";
import * as Commerce from "../lib/live-stream-commerce.js";
import * as Replay from "../lib/live-stream-replay.js";
import * as CFStream from "../lib/cloudflare-stream.js";
import * as VisualModeration from "../lib/visual-moderation.js";

vi.mock("../lib/live-streaming.js", () => ({
  createEvent: vi.fn(),
  listEvents: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  upsertChatRules: vi.fn(),
  getChatRules: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  listViewers: vi.fn(),
  getViewerCount: vi.fn(),
  getPeakViewers: vi.fn(),
  updateViewerPeak: vi.fn(),
  banViewer: vi.fn(),
  muteViewer: vi.fn(),
  pinMessage: vi.fn(),
  unpinMessage: vi.fn(),
  listPinnedMessages: vi.fn(),
  sendLiveMessage: vi.fn(),
  listLiveMessages: vi.fn(),
  recordAnalyticsBucket: vi.fn(),
  getEventAnalytics: vi.fn(),
  getLiveStats: vi.fn(),
}));

vi.mock("../lib/live-stream-commerce.js", () => ({
  mapProductRow: vi.fn((row) => row),
  recordCheckoutClick: vi.fn(),
  showLiveProduct: vi.fn(),
  upsertLiveProduct: vi.fn(),
}));

vi.mock("../lib/live-stream-replay.js", () => ({
  getEventReplayBundle: vi.fn(),
  getPrimaryEventReplay: vi.fn(),
  listEventReplays: vi.fn(),
  reconcileEventAngleReplays: vi.fn(),
  registerManualReplay: vi.fn(),
}));

vi.mock("../lib/cloudflare-stream.js", () => ({
  createLiveInput: vi.fn(),
  deleteLiveInput: vi.fn(),
}));

vi.mock("../lib/visual-moderation.js", () => ({
  analyzeStreamFrame: vi.fn(),
}));

const memberJwt = async () => ({ userId: "u1", projectId: "p1", roles: ["member"] });
const noRoleJwt = async () => ({ userId: "u1", projectId: "p1", roles: [] });

function fakeDb(overrides = {}) {
  const stmt = {
    bind() { return stmt; },
    run: async () => ({ success: true, meta: { changes: 1 } }),
    all: async () => ({ results: [] }),
    first: async () => null,
    ...overrides,
  };
  return { prepare: () => stmt };
}

function deps({ verifyJwt = memberJwt, db = fakeDb(), env } = {}) {
  return createAuthMatrixDeps({
    verifyJwt,
    extra: { env: env ?? { DB: db } },
  });
}

function request(path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchLiveStreamingRoutes(req, new URL(req.url), h);
}

let h;
function useDeps(options) {
  h = deps(options);
}

describe("live routes — dispatch & auth", () => {
  it("returns null for non-live paths and unmatched live routes", async () => {
    useDeps();
    expect(await request("/rooms/r1")).toBeNull();
    expect(await request("/api/live/unknown")).toBeNull();
  });

  it("401s without a JWT and 403s without a role", async () => {
    useDeps();
    const anon = await dispatchLiveStreamingRoutes(
      new Request("http://127.0.0.1:8787/api/live/events"),
      new URL("http://127.0.0.1:8787/api/live/events"),
      createAuthMatrixDeps(),
    );
    expect(anon.status).toBe(401);
    expect((await anon.json()).error).toBe("unauthorized");

    useDeps({ verifyJwt: noRoleJwt });
    const forbidden = await request("/api/live/events");
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error).toBe("forbidden");
  });
});

describe("live routes — events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST creates (projectId injected) and 400s a missing title", async () => {
    useDeps();
    Live.createEvent.mockResolvedValueOnce({ id: "ev_1", title: "Show" });
    const ok = await request("/api/live/events", { method: "POST", body: { title: "Show", roomId: "r1" } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).event.id).toBe("ev_1");
    expect(Live.createEvent).toHaveBeenCalledWith(expect.anything(), { title: "Show", roomId: "r1", projectId: "p1" });

    const bad = await request("/api/live/events", { method: "POST", body: { roomId: "r1" } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("title required");
  });

  it("POST 500s a lib throw with the message", async () => {
    useDeps();
    Live.createEvent.mockRejectedValueOnce(new Error("d1 down"));
    const res = await request("/api/live/events", { method: "POST", body: { title: "Show" } });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("d1 down");
  });

  it("GET lists with status/limit (default 25)", async () => {
    useDeps();
    Live.listEvents.mockResolvedValue([{ id: "ev_1" }]);
    const res = await request("/api/live/events?status=live&limit=5");
    expect(res.status).toBe(200);
    expect((await res.json()).events).toHaveLength(1);
    expect(Live.listEvents).toHaveBeenCalledWith(expect.anything(), { projectId: "p1", status: "live", limit: 5 });

    await request("/api/live/events");
    expect(Live.listEvents).toHaveBeenLastCalledWith(expect.anything(), { projectId: "p1", status: null, limit: 25 });
  });

  it("GET one 404s when missing; PATCH maps updateEvent", async () => {
    useDeps();
    Live.getEvent.mockResolvedValueOnce(null);
    expect((await request("/api/live/events/ev_x")).status).toBe(404);

    Live.getEvent.mockResolvedValueOnce({ id: "ev_1", title: "Show" });
    expect((await request("/api/live/events/ev_1")).status).toBe(200);

    Live.updateEvent.mockResolvedValueOnce({ updated: true });
    const patched = await request("/api/live/events/ev_1", { method: "PATCH", body: { status: "live" } });
    expect(patched.status).toBe(200);
    expect(Live.updateEvent).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", status: "live", projectId: "p1" });
  });

  it("provision: 404, idempotent when already provisioned, success, 503/502", async () => {
    useDeps();
    Live.getEvent.mockResolvedValueOnce(null);
    expect((await request("/api/live/events/ev_x/provision", { method: "POST" })).status).toBe(404);

    Live.getEvent.mockReset();
    Live.getEvent.mockResolvedValueOnce({ id: "ev_1", liveInputUid: "uid_1" });
    const already = await request("/api/live/events/ev_1/provision", { method: "POST" });
    expect(already.status).toBe(200);
    expect(CFStream.createLiveInput).not.toHaveBeenCalled();

    Live.getEvent.mockReset();
    Live.getEvent.mockResolvedValueOnce({ id: "ev_1", title: "Show" }).mockResolvedValueOnce({ id: "ev_1", playbackHls: "https://hls" });
    CFStream.createLiveInput.mockResolvedValueOnce({ uid: "uid_2", rtmpsUrl: "rtmps://x", streamKey: "k", whipUrl: "w", streamUrl: "s", playbackHls: "https://hls", playbackDash: null, providerState: "ok" });
    const ok = await request("/api/live/events/ev_1/provision", { method: "POST" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).playbackHls).toBe("https://hls");
    expect(CFStream.createLiveInput).toHaveBeenCalled();

    Live.getEvent.mockReset();
    Live.getEvent.mockResolvedValueOnce({ id: "ev_1", title: "Show" });
    CFStream.createLiveInput.mockRejectedValueOnce(new Error("cloudflare_stream_not_configured"));
    const missing = await request("/api/live/events/ev_1/provision", { method: "POST" });
    expect(missing.status).toBe(503);

    Live.getEvent.mockReset();
    Live.getEvent.mockResolvedValueOnce({ id: "ev_1", title: "Show" });
    CFStream.createLiveInput.mockRejectedValueOnce(new Error("upstream 500"));
    expect((await request("/api/live/events/ev_1/provision", { method: "POST" })).status).toBe(502);
  });

  it("DELETE input removes the live input and clears the row", async () => {
    useDeps();
    Live.getEvent.mockResolvedValueOnce({ id: "ev_1", liveInputUid: "uid_1" });
    const res = await request("/api/live/events/ev_1/input", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
    expect(CFStream.deleteLiveInput).toHaveBeenCalledWith(expect.anything(), "uid_1");

    Live.getEvent.mockResolvedValueOnce(null);
    expect((await request("/api/live/events/ev_x/input", { method: "DELETE" })).status).toBe(404);
  });
});

describe("live routes — rules, moderation, viewers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rules round-trip", async () => {
    useDeps();
    Live.upsertChatRules.mockResolvedValueOnce({ id: "lcr_1", created: true });
    const post = await request("/api/live/events/ev_1/rules", { method: "POST", body: { slowModeSeconds: 5 } });
    expect(post.status).toBe(200);
    expect(Live.upsertChatRules).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", slowModeSeconds: 5, projectId: "p1" });

    Live.getChatRules.mockResolvedValueOnce({ id: "lcr_1", slowModeSeconds: 5 });
    expect((await request("/api/live/events/ev_1/rules")).status).toBe(200);
  });

  it("moderate-frame: 404, 400 missing image, 503 disabled, 200 ok", async () => {
    useDeps();
    Live.getEvent.mockResolvedValueOnce(null);
    expect((await request("/api/live/events/ev_x/moderate-frame", { method: "POST", body: { imageBase64: "AA" } })).status).toBe(404);

    Live.getEvent.mockResolvedValue({ id: "ev_1", roomId: "r1" });
    expect((await request("/api/live/events/ev_1/moderate-frame", { method: "POST", body: {} })).status).toBe(400);

    VisualModeration.analyzeStreamFrame.mockResolvedValueOnce({ ok: false, error: "visual_moderation_disabled" });
    expect((await request("/api/live/events/ev_1/moderate-frame", { method: "POST", body: { imageBase64: "AA" } })).status).toBe(503);

    VisualModeration.analyzeStreamFrame.mockResolvedValueOnce({ ok: true, severity: "none", safe: true });
    const ok = await request("/api/live/events/ev_1/moderate-frame", { method: "POST", body: { imageBase64: "AA", frameIndex: 2 } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).safe).toBe(true);
    expect(VisualModeration.analyzeStreamFrame).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: "p1", eventId: "ev_1", frameIndex: 2 }),
    );
  });

  it("join/leave use the caller userId", async () => {
    useDeps();
    Live.joinEvent.mockResolvedValueOnce({ id: "lv_1" });
    await request("/api/live/events/ev_1/join", { method: "POST", body: {} });
    expect(Live.joinEvent).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", projectId: "p1", userId: "u1" });

    Live.leaveEvent.mockResolvedValueOnce({ left: 1 });
    const left = await request("/api/live/events/ev_1/leave", { method: "POST", body: {} });
    expect((await left.json()).left).toBe(1);
  });

  it("viewers/count/peak mapping", async () => {
    useDeps();
    Live.listViewers.mockResolvedValueOnce([{ id: "lv_1" }]);
    await request("/api/live/events/ev_1/viewers?role=viewer");
    expect(Live.listViewers).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", role: "viewer", limit: 100 });

    Live.getViewerCount.mockResolvedValueOnce({ count: 3 });
    expect((await (await request("/api/live/events/ev_1/viewer-count")).json()).count).toBe(3);

    Live.getPeakViewers.mockResolvedValueOnce({ peakViewers: 9, totalViewers: 20 });
    expect((await (await request("/api/live/events/ev_1/peak")).json()).totalViewers).toBe(20);

    Live.updateViewerPeak.mockResolvedValueOnce({ peakViewers: 10 });
    expect((await (await request("/api/live/events/ev_1/peak", { method: "POST" })).json()).peakViewers).toBe(10);
  });

  it("ban and mute map their bodies", async () => {
    useDeps();
    Live.banViewer.mockResolvedValueOnce({ banned: true });
    Live.muteViewer.mockResolvedValueOnce({ muted: false });
    await request("/api/live/events/ev_1/ban", { method: "POST", body: { userId: "u9" } });
    await request("/api/live/events/ev_1/mute", { method: "POST", body: { userId: "u9", muted: false } });
    expect(Live.banViewer).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", userId: "u9", projectId: "p1" });
    expect(Live.muteViewer).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", userId: "u9", muted: false, projectId: "p1" });
  });
});

describe("live routes — chat, pins, analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("messages post/list mapping", async () => {
    useDeps();
    Live.sendLiveMessage.mockResolvedValueOnce({ id: "lcm_1" });
    await request("/api/live/events/ev_1/messages", { method: "POST", body: { content: "hi" } });
    expect(Live.sendLiveMessage).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", content: "hi", projectId: "p1" });

    Live.listLiveMessages.mockResolvedValueOnce([{ id: "lcm_1" }]);
    await request("/api/live/events/ev_1/messages?limit=20&before=t0");
    expect(Live.listLiveMessages).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", limit: 20, before: "t0" });

    await request("/api/live/events/ev_1/messages");
    expect(Live.listLiveMessages).toHaveBeenLastCalledWith(expect.anything(), { eventId: "ev_1", limit: 100, before: null });
  });

  it("pins: pin, unpin (body pinId), pinned list", async () => {
    useDeps();
    Live.pinMessage.mockResolvedValueOnce({ id: "lp_1" });
    Live.unpinMessage.mockResolvedValueOnce({ unpinned: true });
    Live.listPinnedMessages.mockResolvedValueOnce([{ id: "lp_1" }]);
    await request("/api/live/events/ev_1/pin", { method: "POST", body: { messageId: "lcm_1" } });
    const unpin = await request("/api/live/events/ev_1/unpin", { method: "POST", body: { pinId: "lp_1" } });
    const pinned = await request("/api/live/events/ev_1/pinned");
    expect((await unpin.json()).unpinned).toBe(true);
    expect((await pinned.json())).toHaveLength(1);
    expect(Live.pinMessage).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", messageId: "lcm_1", projectId: "p1" });
    expect(Live.unpinMessage).toHaveBeenCalledWith(expect.anything(), { pinId: "lp_1", projectId: "p1" });
  });

  it("analytics post/get mapping and stats", async () => {
    useDeps();
    Live.recordAnalyticsBucket.mockResolvedValueOnce({ id: "la_1" });
    await request("/api/live/events/ev_1/analytics", { method: "POST", body: { timestampBucket: "b1" } });
    expect(Live.recordAnalyticsBucket).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", timestampBucket: "b1", projectId: "p1" });

    Live.getEventAnalytics.mockResolvedValueOnce([{ id: "la_1" }]);
    await request("/api/live/events/ev_1/analytics?fromBucket=a&toBucket=b");
    expect(Live.getEventAnalytics).toHaveBeenCalledWith(expect.anything(), { eventId: "ev_1", fromBucket: "a", toBucket: "b" });

    Live.getLiveStats.mockResolvedValueOnce({ events: [{ status: "live", count: 1 }], totalMessages: 4, totalViewers: 20 });
    const stats = await request("/api/live/stats");
    expect((await stats.json()).totalMessages).toBe(4);
    expect(Live.getLiveStats).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" });
  });
});

describe("live routes — angles, highlights, commerce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("angles list/post, with provision 503 on failure", async () => {
    useDeps();
    const list = await request("/api/live/events/ev_1/angles");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([]);

    const created = await request("/api/live/events/ev_1/angles", { method: "POST", body: { label: "Cam 2" } });
    expect(created.status).toBe(200);
    expect(String((await created.json()).id)).toMatch(/^ang_/);

    CFStream.createLiveInput.mockRejectedValueOnce(new Error("cloudflare_stream_not_configured"));
    const failed = await request("/api/live/events/ev_1/angles", { method: "POST", body: { label: "Cam 3", provisionCloudflare: true } });
    expect(failed.status).toBe(503);
    expect((await failed.json()).error).toBe("cloudflare_angle_provision_failed");
  });

  it("highlights list/post", async () => {
    useDeps();
    expect(await (await request("/api/live/events/ev_1/highlights")).json()).toEqual([]);
    const created = await request("/api/live/events/ev_1/highlights", { method: "POST", body: { title: "Save" } });
    expect(String((await created.json()).id)).toMatch(/^hl_/);
  });

  it("products get/post with 404 passthrough", async () => {
    useDeps();
    expect(await (await request("/api/live/events/ev_1/products")).json()).toEqual([]);

    Commerce.upsertLiveProduct.mockResolvedValueOnce({ ok: true, product: { id: "pr_1", name: "Mug" } });
    const created = await request("/api/live/events/ev_1/products", { method: "POST", body: { name: "Mug" } });
    expect(created.status).toBe(200);
    expect((await created.json()).product.name).toBe("Mug");

    Commerce.upsertLiveProduct.mockResolvedValueOnce({ ok: false, error: "event_not_found" });
    expect((await request("/api/live/events/ev_x/products", { method: "POST", body: { name: "Mug" } })).status).toBe(404);
  });

  it("show product and checkout-click status mapping", async () => {
    useDeps();
    Commerce.showLiveProduct.mockResolvedValueOnce({ ok: false, error: "product_not_found" });
    expect((await request("/api/live/events/ev_1/products/pr_x/show", { method: "POST" })).status).toBe(404);

    Commerce.showLiveProduct.mockResolvedValueOnce({ ok: true, product: { id: "pr_1" } });
    expect((await request("/api/live/events/ev_1/products/pr_1/show", { method: "POST" })).status).toBe(200);

    Commerce.recordCheckoutClick.mockResolvedValueOnce({ ok: false, error: "insufficient_inventory" });
    expect((await request("/api/live/events/ev_1/products/pr_1/checkout-click", { method: "POST", body: { quantity: 9 } })).status).toBe(409);

    Commerce.recordCheckoutClick.mockResolvedValueOnce({ ok: false, error: "below_moq" });
    expect((await request("/api/live/events/ev_1/products/pr_1/checkout-click", { method: "POST", body: {} })).status).toBe(409);

    Commerce.recordCheckoutClick.mockResolvedValueOnce({ ok: true, checkoutUrl: "https://shop/x", quantity: 1, product: { id: "pr_1" } });
    const ok = await request("/api/live/events/ev_1/products/pr_1/checkout-click", { method: "POST", body: { quantity: 1 } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).checkoutUrl).toBe("https://shop/x");
  });
});

describe("live routes — replays, gifts, sentiment, TURN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replays: list/register (404/400), bundle, primary", async () => {
    useDeps();
    Replay.listEventReplays.mockResolvedValueOnce([{ id: "rp_1" }]);
    expect((await (await request("/api/live/events/ev_1/replays")).json()).replays).toHaveLength(1);

    Replay.registerManualReplay.mockResolvedValueOnce({ ok: true, replay: { id: "rp_2" } });
    Replay.registerManualReplay.mockResolvedValueOnce({ ok: false, error: "event_not_found" });
    Replay.registerManualReplay.mockResolvedValueOnce({ ok: false, error: "invalid_playback_url" });
    expect((await request("/api/live/events/ev_1/replays", { method: "POST", body: { playbackHls: "https://hls" } })).status).toBe(200);
    expect((await request("/api/live/events/ev_x/replays", { method: "POST", body: { playbackHls: "https://hls" } })).status).toBe(404);
    expect((await request("/api/live/events/ev_1/replays", { method: "POST", body: { playbackHls: "bad" } })).status).toBe(400);

    Replay.getEventReplayBundle.mockResolvedValueOnce({ replay: { id: "rp_1" }, angleReplays: [], syncGroupId: null, chatTimeline: [] });
    expect((await (await request("/api/live/events/ev_1/replay")).json()).replay.id).toBe("rp_1");

    Replay.getPrimaryEventReplay.mockResolvedValueOnce({ id: "rp_1" });
    expect((await (await request("/api/live/events/ev_1/replay/primary")).json()).replay.id).toBe("rp_1");
  });

  it("reconcile: 200, 404, 503 not configured, 502 upstream; reconcile-angles 400/503", async () => {
    useDeps();
    Replay.reconcileEventAngleReplays.mockResolvedValueOnce({ ok: true, replays: [], synced: 1, syncGroupId: "sg_1" });
    expect((await request("/api/live/events/ev_1/replays/reconcile", { method: "POST" })).status).toBe(200);

    Replay.reconcileEventAngleReplays.mockResolvedValueOnce({ ok: false, error: "event_not_found" });
    expect((await request("/api/live/events/ev_x/replays/reconcile", { method: "POST" })).status).toBe(404);

    Replay.reconcileEventAngleReplays.mockRejectedValueOnce(new Error("cloudflare_stream_not_configured"));
    expect((await request("/api/live/events/ev_1/replays/reconcile", { method: "POST" })).status).toBe(503);

    Replay.reconcileEventAngleReplays.mockRejectedValueOnce(new Error("upstream"));
    expect((await request("/api/live/events/ev_1/replays/reconcile", { method: "POST" })).status).toBe(502);

    Replay.reconcileEventAngleReplays.mockResolvedValueOnce({ ok: false, error: "no_live_input" });
    expect((await request("/api/live/events/ev_1/replays/reconcile-angles", { method: "POST" })).status).toBe(400);

    Replay.reconcileEventAngleReplays.mockRejectedValueOnce(new Error("cloudflare_stream_not_configured"));
    expect((await request("/api/live/events/ev_1/replays/reconcile-angles", { method: "POST" })).status).toBe(503);
  });

  it("gifts get/post and sentiment get", async () => {
    useDeps();
    expect(await (await request("/api/live/events/ev_1/gifts")).json()).toEqual([]);
    const gift = await request("/api/live/events/ev_1/gifts", { method: "POST", body: { giftType: "tip", amount: 5 } });
    expect(String((await gift.json()).id)).toMatch(/^gift_/);
    expect(await (await request("/api/live/events/ev_1/sentiment")).json()).toEqual([]);
  });

  it("turn-credentials: STUN + honest note when unconfigured, HMAC when TURN_SECRET set", async () => {
    useDeps();
    const unconfigured = await request("/api/live/turn-credentials");
    const body = await unconfigured.json();
    expect(body.iceServers[0].urls).toContain("stun:");
    expect(body.note).toContain("TURN not configured");

    useDeps({ env: { DB: fakeDb(), TURN_SECRET: "s3cret" } });
    const configured = await request("/api/live/turn-credentials");
    const turn = await configured.json();
    expect(turn.ttl).toBe(3600);
    expect(turn.iceServers[0].urls).toBe("turn:turn.example.com:3478");
    expect(turn.iceServers[0].username).toMatch(/:u1$/);
    expect(typeof turn.iceServers[0].credential).toBe("string");
  });
});
