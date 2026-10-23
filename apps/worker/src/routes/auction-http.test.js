import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/room-access.js", () => ({
  canAccessRoom: vi.fn(async () => true),
}));
vi.mock("../lib/live-auctions.js", () => ({
  createLot: vi.fn(async () => ({ id: "lot_1" })),
  startLot: vi.fn(async () => ({ started: true })),
  getLot: vi.fn(async () => ({ id: "lot_1" })),
  getLotsByRoom: vi.fn(async () => []),
  placeBid: vi.fn(async () => ({ bid: true })),
  extendLot: vi.fn(async () => ({ extended: true })),
  closeLot: vi.fn(async () => ({ closed: true })),
  getBidsForLot: vi.fn(async () => []),
  watchLot: vi.fn(async () => ({ watching: true })),
  unwatchLot: vi.fn(async () => ({ removed: 1 })),
  getWatchers: vi.fn(async () => []),
  getAuctionStats: vi.fn(async () => ({})),
}));

import { canAccessRoom } from "../lib/room-access.js";
import { getLot, placeBid } from "../lib/live-auctions.js";
import { dispatchAuctionRoutes } from "./auction-http.js";

function buildDeps(overrides = {}) {
  return {
    env: { DB: {} },
    corsHeaders: { "access-control-allow-origin": "*" },
    verifyJwtAndGetContext:
      overrides.verifyJwt ?? (async () => ({ userId: "u1", projectId: "p1", roles: ["member"] })),
    hasAnyRole: (roles, allowed) => (roles || []).some((r) => allowed.includes(r)),
  };
}

function req(method, path, body) {
  return new Request(`http://127.0.0.1:8787${path}`, {
    method,
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
}

describe("auction routes (audit F-18)", () => {
  beforeEach(() => {
    vi.mocked(canAccessRoom).mockResolvedValue(true);
    vi.mocked(getLot).mockResolvedValue({ id: "lot_1" });
  });

  it("requires authentication", async () => {
    const res = await dispatchAuctionRoutes(
      req("GET", "/rooms/r1/auction/lots"),
      new URL("http://127.0.0.1:8787/rooms/r1/auction/lots"),
      buildDeps({ verifyJwt: async () => null }),
    );
    expect(res.status).toBe(401);
  });

  it("hides rooms the caller cannot access", async () => {
    vi.mocked(canAccessRoom).mockResolvedValue(false);
    const res = await dispatchAuctionRoutes(
      req("GET", "/rooms/r1/auction/lots"),
      new URL("http://127.0.0.1:8787/rooms/r1/auction/lots"),
      buildDeps(),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
  });

  it("404s a lot that is not in the caller's project", async () => {
    vi.mocked(getLot).mockResolvedValue(null);
    const res = await dispatchAuctionRoutes(
      req("GET", "/rooms/r1/auction/lots/lot_x"),
      new URL("http://127.0.0.1:8787/rooms/r1/auction/lots/lot_x"),
      buildDeps(),
    );
    expect(res.status).toBe(404);
    expect(getLot).toHaveBeenCalledWith(expect.anything(), "lot_x", "p1");
  });

  it("bids with the JWT user id, not a body value", async () => {
    const deps = buildDeps();
    const res = await dispatchAuctionRoutes(
      req("POST", "/rooms/r1/auction/lots/lot_1/bid", { amount: 500, userId: "attacker" }),
      new URL("http://127.0.0.1:8787/rooms/r1/auction/lots/lot_1/bid"),
      deps,
    );
    expect(res.status).toBe(200);
    expect(placeBid).toHaveBeenCalledWith(expect.anything(), {
      lotId: "lot_1",
      userId: "u1",
      amount: 500,
    });
  });

  it("lets only owner/admin create lots", async () => {
    const res = await dispatchAuctionRoutes(
      req("POST", "/rooms/r1/auction/lots", { title: "Vase" }),
      new URL("http://127.0.0.1:8787/rooms/r1/auction/lots"),
      buildDeps(),
    );
    expect(res.status).toBe(403);
  });
});
