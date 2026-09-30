import { describe, expect, it, vi } from "vitest";
import { createFluxyTokenRoute } from "./create-fluxy-token-route";

describe("createFluxyTokenRoute", () => {
  it("returns 401 without a user", async () => {
    const POST = createFluxyTokenRoute({
      workerUrl: "https://worker.example",
      apiKey: "fc_test",
      getUserId: async () => null,
    });
    const res = await POST(new Request("https://app.example/api/fluxy-token", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("forwards userId to POST /auth/token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: "jwt" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const POST = createFluxyTokenRoute({
      workerUrl: "https://worker.example/",
      apiKey: "fc_test",
      getUserId: async () => "user_1",
    });
    const res = await POST(new Request("https://app.example/api/fluxy-token", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example/auth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Fluxy-Api-Key": "fc_test" }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
