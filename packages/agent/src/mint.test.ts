import { afterEach, describe, expect, it, vi } from "vitest";
import { mintWorkerToken } from "./mint";

describe("mintWorkerToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs to /auth/token with api key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "jwt_test",
          expiresIn: 3600,
          claims: { sub: "agent-1", tid: "proj", roles: ["member"] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await mintWorkerToken({
      baseUrl: "http://127.0.0.1:8787",
      apiKey: "fc_test_key",
      userId: "agent-1",
      roles: ["member"],
    });

    expect(result.token).toBe("jwt_test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8787/auth/token");
    expect((init.headers as Record<string, string>)["X-Fluxy-Api-Key"]).toBe("fc_test_key");
  });
});
