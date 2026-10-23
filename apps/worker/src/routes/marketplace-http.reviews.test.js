import { describe, expect, it, vi } from "vitest";
import { dispatchMarketplaceRoutes } from "./marketplace-http.js";
import { addReview } from "../lib/agent-marketplace.js";

vi.mock("../lib/admin-route-context.js", () => ({
  resolveMemberContext: async () => ({
    projectId: "proj_own",
    userId: "u_own",
    auth: { roles: ["member"] },
  }),
}));
vi.mock("../lib/agent-marketplace.js", () => ({
  publishAgent: vi.fn(),
  updateAgent: vi.fn(),
  submitForReview: vi.fn(),
  reviewAgent: vi.fn(),
  getAgent: vi.fn(),
  getAgentBySlug: vi.fn(),
  listAgents: vi.fn(),
  listPublisherAgents: vi.fn(),
  installAgent: vi.fn(),
  uninstallAgent: vi.fn(),
  listInstalledAgents: vi.fn(),
  addReview: vi.fn(async () => ({ id: "amr_1" })),
  listReviews: vi.fn(),
  getMarketplaceStats: vi.fn(),
}));
vi.mock("../lib/marketplace-apps.js", () => ({
  listProjectApps: vi.fn(),
  publishProjectApp: vi.fn(),
  deleteProjectApp: vi.fn(),
}));

describe("POST /admin/marketplace/reviews attribution (A2-7)", () => {
  it("A2-7: a review is attributed to the authenticated user, not the body", async () => {
    const h = {
      env: {},
      json: (body, _h, status) =>
        new Response(JSON.stringify(body), { status: status ?? 200 }),
      hasAnyRole: () => false,
    };
    const url = "https://worker.example/admin/marketplace/reviews";
    const request = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "ag1", rating: 5, userId: "u_victim" }),
    });
    const res = await dispatchMarketplaceRoutes(request, new URL(url), h);
    expect(res.status).toBe(201);
    expect(addReview).toHaveBeenCalledTimes(1);
    expect(addReview.mock.calls[0][1].userId).toBe("u_own");
  });
});
