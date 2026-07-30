import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluxyClientCredentials } from "./client-credentials";

function b64Json(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `hdr.${b64Json(payload)}.sig`;
}

describe("FluxyClientCredentials", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns static user token without minting", async () => {
    const creds = new FluxyClientCredentials({
      baseUrl: "http://127.0.0.1:8787",
      apiKey: "fc_key",
      token: "jwt_static",
    });
    await expect(creds.resolve()).resolves.toBe("jwt_static");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints anonymous token when no user token", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = fakeJwt({ sub: "anon_abc123", exp });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token, userId: "anon_abc123", expiresIn: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const creds = new FluxyClientCredentials({
      baseUrl: "http://127.0.0.1:8787",
      apiKey: "fc_key",
    });
    await expect(creds.resolve()).resolves.toBe(token);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/tokens/anonymous",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("dedupes concurrent mint requests", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = fakeJwt({ sub: "anon_xyz", exp });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token, userId: "anon_xyz" }), { status: 200 }),
    );

    const creds = new FluxyClientCredentials({
      baseUrl: "http://127.0.0.1:8787",
      apiKey: "fc_key",
    });
    const [a, b] = await Promise.all([creds.resolve(), creds.resolve()]);
    expect(a).toBe(token);
    expect(b).toBe(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("setToken clears anonymous cache", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const anon = fakeJwt({ sub: "anon_old", exp });
    const user = fakeJwt({ sub: "alice", exp });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: anon, userId: "anon_old" }), { status: 200 }),
    );

    const creds = new FluxyClientCredentials({
      baseUrl: "http://127.0.0.1:8787",
      apiKey: "fc_key",
    });
    await creds.resolve();
    const changed = creds.setToken(user);
    expect(changed).toBe(true);
    await expect(creds.resolve()).resolves.toBe(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
