import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { createWorkerFluxyStreamClient } from "./worker-fluxy-stream-client";

const baseUrl = "http://127.0.0.1:8787";

function client() {
  return createWorkerFluxyStreamClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function callUrl(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return String(mock.mock.calls[i]?.[0]);
}

function callInit(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return mock.mock.calls[i]?.[1] as RequestInit;
}

function callBody(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return JSON.parse(String((mock.mock.calls[i]?.[1] as RequestInit).body));
}

function callHeaders(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return (mock.mock.calls[i]?.[1] as RequestInit).headers as Record<string, string>;
}

describe("createWorkerFluxyStreamClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates, lists and gets events", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ event: { id: "ev_1", title: "Show", status: "scheduled", roomId: "r1" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [{ id: "ev_1", title: "Show" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "ev_1", title: "Show", status: "live" }));
    const stream = client();
    const created = await stream.createEvent({ title: "Show", roomId: "r1" });
    const events = await stream.listEvents({ status: "live", limit: 5 });
    const one = await stream.getEvent("ev_1");
    expect(created.id).toBe("ev_1");
    expect(created.roomId).toBe("r1");
    expect(events).toHaveLength(1);
    expect(one?.status).toBe("live");
    expect(callBody(fetchMock, 0)).toEqual({ title: "Show", roomId: "r1" });
    expect(callUrl(fetchMock, 1)).toContain("/api/live/events?status=live&limit=5");
    expect(callHeaders(fetchMock, 0).Authorization).toBe("Bearer jwt");
  });

  it("getEvent returns null on 404 instead of throwing", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "not_found" }, 404));
    const stream = client();
    await expect(stream.getEvent("ev_missing")).resolves.toBeNull();
  });

  it("updateEvent and goLive PATCH and return {updated}", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ updated: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ updated: true }));
    const stream = client();
    const renamed = await stream.updateEvent("ev_1", { title: "Renamed" });
    const live = await stream.goLive("ev_1");
    expect(renamed.updated).toBe(true);
    expect(live.updated).toBe(true);
    expect(callInit(fetchMock, 0).method).toBe("PATCH");
    expect(callBody(fetchMock, 0)).toEqual({ title: "Renamed" });
    expect(callBody(fetchMock, 1)).toEqual({ status: "live" });
  });

  it("provision maps the event; deleteInput DELETEs", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "ev_1", title: "Show", playbackHls: "https://hls" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ deleted: true }));
    const stream = client();
    const event = await stream.provision("ev_1");
    const removed = await stream.deleteInput("ev_1");
    expect(event.playbackHls).toBe("https://hls");
    expect(removed.deleted).toBe(true);
    expect(callInit(fetchMock, 1).method).toBe("DELETE");
    expect(callUrl(fetchMock, 1)).toContain("/api/live/events/ev_1/input");
  });

  it("join/leave map their real response shapes", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "lv_1" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ left: 1 }));
    const stream = client();
    const joined = await stream.join("ev_1");
    const left = await stream.leave("ev_1");
    expect(joined.id).toBe("lv_1");
    expect(left.left).toBe(1);
    expect(callBody(fetchMock, 0)).toEqual({});
  });

  it("angles: list handles a direct array, create posts the input", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "ang_1", label: "Main" }]));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "ang_2", liveInputUid: "uid", playbackHls: "https://hls" }));
    const stream = client();
    const angles = await stream.listAngles("ev_1");
    const created = await stream.createAngle("ev_1", { label: "Cam 2", provisionCloudflare: true });
    expect(angles[0]?.label).toBe("Main");
    expect(created.id).toBe("ang_2");
    expect(created.liveInputUid).toBe("uid");
    expect(callBody(fetchMock, 1)).toEqual({ label: "Cam 2", provisionCloudflare: true });
  });

  it("viewers: list filters, count, peak get/update", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "lv_1", role: "viewer" }]));
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 3 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ peakViewers: 9, totalViewers: 20 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ peakViewers: 10 }));
    const stream = client();
    const viewers = await stream.listViewers("ev_1", { role: "viewer", limit: 50 });
    const count = await stream.getViewerCount("ev_1");
    const peak = await stream.getPeak("ev_1");
    const updated = await stream.updatePeak("ev_1");
    expect(viewers[0]?.role).toBe("viewer");
    expect(count.count).toBe(3);
    expect(peak.totalViewers).toBe(20);
    expect(updated.peakViewers).toBe(10);
    expect(callUrl(fetchMock, 0)).toContain("/viewers?role=viewer&limit=50");
    expect(callInit(fetchMock, 3).method).toBe("POST");
  });

  it("moderation: ban and mute post the user id", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ banned: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ muted: false }));
    const stream = client();
    await stream.banViewer("ev_1", "u_9");
    const unmuted = await stream.muteViewer("ev_1", "u_9", false);
    expect(unmuted.muted).toBe(false);
    expect(callBody(fetchMock, 0)).toEqual({ userId: "u_9" });
    expect(callBody(fetchMock, 1)).toEqual({ userId: "u_9", muted: false });
  });

  it("pins: pin, unpin and list", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "lp_1" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ unpinned: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "lp_1", messageId: "lcm_1" }]));
    const stream = client();
    const pin = await stream.pinMessage("ev_1", "lcm_1");
    const unpin = await stream.unpinMessage("lp_1");
    const pinned = await stream.listPinnedMessages("ev_1");
    expect(pin.id).toBe("lp_1");
    expect(unpin.unpinned).toBe(true);
    expect(pinned[0]?.messageId).toBe("lcm_1");
    expect(callBody(fetchMock, 0)).toEqual({ messageId: "lcm_1" });
    expect(callBody(fetchMock, 1)).toEqual({ pinId: "lp_1" });
  });

  it("chat: send and list messages with limit/before", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "lcm_2" }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "lcm_1", content: "hi" }]));
    const stream = client();
    const sent = await stream.sendMessage("ev_1", { content: "hi", username: "Alice" });
    const history = await stream.listMessages("ev_1", { limit: 20, before: "2026-10-16T10:00:00Z" });
    expect(sent.id).toBe("lcm_2");
    expect(history[0]?.content).toBe("hi");
    expect(callUrl(fetchMock, 1)).toContain("limit=20&before=");
  });

  it("analytics and stats", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "la_1" }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "la_1", messagesCount: 4 }]));
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [{ status: "live", count: 1 }], totalMessages: 4, totalViewers: 20 }));
    const stream = client();
    const recorded = await stream.recordAnalytics("ev_1", { timestampBucket: "2026-10-16T10:00Z", messagesCount: 4 });
    const buckets = await stream.getAnalytics("ev_1", { fromBucket: "a", toBucket: "b" });
    const stats = await stream.getStats();
    expect(recorded.id).toBe("la_1");
    expect(buckets[0]?.messagesCount).toBe(4);
    expect(stats.totalViewers).toBe(20);
    expect(callUrl(fetchMock, 1)).toContain("fromBucket=a&toBucket=b");
    expect(callUrl(fetchMock, 2)).toBe(`${baseUrl}/api/live/stats`);
  });

  it("commerce: list (array or wrapped), upsert, show, checkout click", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "pr_1", name: "Mug" }]));
    fetchMock.mockResolvedValueOnce(jsonResponse({ product: { id: "pr_1", name: "Mug", checkoutUrl: "https://shop/mug" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ product: { id: "pr_1", name: "Mug", shownAt: "t" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, checkoutUrl: "https://shop/mug", paymentStatus: "paid", quantity: 2, product: { id: "pr_1", name: "Mug" } }));
    const stream = client();
    const products = await stream.listProducts("ev_1");
    const upserted = await stream.upsertProduct("ev_1", { name: "Mug", priceAmount: 900 });
    const shown = await stream.showProduct("ev_1", "pr_1");
    const click = await stream.recordCheckoutClick("ev_1", "pr_1", 2);
    expect(products[0]?.name).toBe("Mug");
    expect(upserted.checkoutUrl).toBe("https://shop/mug");
    expect(shown.shownAt).toBe("t");
    expect(click.checkoutUrl).toBe("https://shop/mug");
    expect(click.paymentStatus).toBe("paid");
    expect(click.quantity).toBe(2);
    expect(click.product.name).toBe("Mug");
  });

  it("highlights: list handles a direct array, create posts", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "hl_1", title: "Goal" }]));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "hl_2" }));
    const stream = client();
    const highlights = await stream.listHighlights("ev_1");
    const created = await stream.createHighlight("ev_1", { title: "Save", startSeconds: 10, endSeconds: 20 });
    expect(highlights[0]?.title).toBe("Goal");
    expect(created.id).toBe("hl_2");
    expect(callBody(fetchMock, 1)).toEqual({ title: "Save", startSeconds: 10, endSeconds: 20 });
  });

  it("replays: list, bundle, primary, register, reconcile (both)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ replays: [{ id: "rp_1", status: "ready" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ replay: { id: "rp_1" }, angleReplays: [], syncGroupId: null, chatTimeline: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ replay: { id: "rp_1" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ replay: { id: "rp_2", status: "processing" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, replays: [{ id: "rp_1" }], synced: 1 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, replays: [{ id: "rp_1" }], synced: 1, syncGroupId: "sg_1" }));
    const stream = client();
    const list = await stream.listReplays("ev_1");
    const bundle = await stream.getReplayBundle("ev_1");
    const primary = await stream.getPrimaryReplay("ev_1");
    const registered = await stream.registerReplay("ev_1", { playbackHls: "https://hls" });
    const reconciled = await stream.reconcileReplays("ev_1");
    const angles = await stream.reconcileAngleReplays("ev_1");
    expect(list).toHaveLength(1);
    expect(bundle.replay?.id).toBe("rp_1");
    expect(primary?.id).toBe("rp_1");
    expect(registered.status).toBe("processing");
    expect(reconciled.synced).toBe(1);
    expect(angles.syncGroupId).toBe("sg_1");
    expect(callUrl(fetchMock, 5)).toContain("/replays/reconcile-angles");
  });

  it("gifts and sentiment", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "gift_1", giftType: "tip", amount: 5 }]));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "gift_2" }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "sen_1", score: 0.8 }]));
    const stream = client();
    const gifts = await stream.listGifts("ev_1");
    const sent = await stream.sendGift("ev_1", { giftType: "tip", amount: 10 });
    const sentiment = await stream.getSentiment("ev_1");
    expect(gifts[0]?.amount).toBe(5);
    expect(sent.id).toBe("gift_2");
    expect(sentiment[0]?.score).toBe(0.8);
    expect(callBody(fetchMock, 1)).toEqual({ giftType: "tip", amount: 10 });
  });

  it("chat rules: get returns null when empty, upsert reports created/updated", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "lcr_1", created: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "lcr_1", updated: true }));
    const stream = client();
    const empty = await stream.getChatRules("ev_1");
    const created = await stream.upsertChatRules("ev_1", { slowModeSeconds: 5 });
    const updated = await stream.upsertChatRules("ev_1", { emoteOnly: true });
    expect(empty).toBeNull();
    expect(created.created).toBe(true);
    expect(updated.updated).toBe(true);
    expect(callBody(fetchMock, 1)).toEqual({ slowModeSeconds: 5 });
  });

  it("turn credentials and frame moderation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ iceServers: [{ urls: "turn:turn.example.com:3478" }], ttl: 3600 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, severity: "none", safe: true }));
    const stream = client();
    const turn = await stream.getTurnCredentials();
    const moderation = await stream.moderateFrame("ev_1", { imageBase64: "AAAA", frameIndex: 3 });
    expect(turn.ttl).toBe(3600);
    expect(moderation.safe).toBe(true);
    expect(callUrl(fetchMock, 0)).toBe(`${baseUrl}/api/live/turn-credentials`);
    expect(callBody(fetchMock, 1)).toEqual({ imageBase64: "AAAA", frameIndex: 3 });
  });

  it("names the failing operation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "off" }, 503));
    const stream = client();
    await expect(stream.listEvents()).rejects.toThrow("listEvents failed: 500");
    await expect(stream.moderateFrame("ev_1", { imageBase64: "AA" })).rejects.toThrow("moderateFrame failed: 503");
  });
});
