import { describe, it, expect, vi, afterEach } from "vitest";
import { safeOutboundFetch } from "./url-ssrf";

function redirectResponse(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safeOutboundFetch redirect handling (S-15b)", () => {
  it("returns a non-redirect response unchanged", async () => {
    const ok = new Response("hello", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok));
    const res = await safeOutboundFetch("https://example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello");
  });

  it("blocks a redirect to a private/loopback address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("http://169.254.169.254/latest/meta-data/"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeOutboundFetch("https://example.com")).rejects.toThrow(
      "ssrf_blocked",
    );
  });

  it("blocks a redirect to 127.0.0.1", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("http://127.0.0.1:8080/admin"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeOutboundFetch("https://example.com")).rejects.toThrow(
      "ssrf_blocked",
    );
  });

  it("follows a redirect to another public address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse("https://other.example.org/final"))
      .mockResolvedValueOnce(new Response("final", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await safeOutboundFetch("https://example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("final");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after too many redirects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(redirectResponse("https://loop.example.org/next"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeOutboundFetch("https://example.com")).rejects.toThrow(
      "ssrf_too_many_redirects",
    );
  });
});
