import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveHosts } from "../src/config.js";
import { createFetchHttpClient } from "../src/http/fetch.js";
import { buildChannelUpgradeUrl, buildInboxUpgradeUrl } from "../src/url.js";

/**
 * These assertions are literal strings, deliberately not built from the same
 * constants (`UPGRADE_PARAMS`, path templates) the implementation uses — the
 * whole point is that this file can disagree with the code. A mock transport
 * that accepts whatever URL the SDK builds can't catch a self-consistent
 * mistake; only a hardcoded expectation can.
 */

describe("resolveHosts — literal production origins", () => {
  it("resolves the default hosts and derives the realtime HTTP origin", () => {
    const hosts = resolveHosts({ apiKey: "pk_test" });
    expect(hosts.apiUrl).toBe("https://api.useportal.co");
    expect(hosts.realtimeUrl).toBe("wss://realtime.useportal.co");
    expect(hosts.realtimeHttpUrl).toBe("https://realtime.useportal.co");
  });
});

describe("buildChannelUpgradeUrl — literal wire contract", () => {
  it("builds /v1/channels/{id} on the realtime host", () => {
    const url = buildChannelUpgradeUrl({
      realtimeUrl: "wss://realtime.useportal.co",
      channelId: "room-7",
      token: "jwt-abc",
      apiKey: "pk_test",
      leaf: "L3:g2",
      last: 42,
    });
    expect(url).toBe(
      "wss://realtime.useportal.co/v1/channels/room-7?v=1&token=jwt-abc&key=pk_test&leaf=L3%3Ag2&last=42",
    );
  });
});

describe("buildInboxUpgradeUrl — literal wire contract", () => {
  it("builds /inbox (no /v1) on the realtime host", () => {
    const url = buildInboxUpgradeUrl({
      realtimeUrl: "wss://realtime.useportal.co",
      token: "jwt-abc",
      apiKey: "pk_test",
    });
    expect(url).toBe("wss://realtime.useportal.co/inbox?v=1&token=jwt-abc&key=pk_test");
  });
});

describe("HTTP client — literal wire contract", () => {
  const fetchMock = vi.fn();
  const originalFetch = global.fetch;

  afterEach(() => {
    fetchMock.mockReset();
    global.fetch = originalFetch;
  });

  function stubFetch(body: unknown): void {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
  }

  it("publish() → POST the realtime host, not the api host", async () => {
    stubFetch({ id: "m_1", seq: 1, timestamp: 0 });
    const client = createFetchHttpClient({
      httpUrl: "https://realtime.useportal.co",
      apiKey: "pk_test",
      token: () => Promise.resolve("jwt-abc"),
    });
    await client.publish("room-7", { content: {} });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://realtime.useportal.co/v1/channels/room-7/messages",
    );
  });

  it("history() → GET the realtime host, not the api host", async () => {
    stubFetch({ msgs: [], hasMore: false });
    const client = createFetchHttpClient({
      httpUrl: "https://realtime.useportal.co",
      apiKey: "pk_test",
      token: () => Promise.resolve("jwt-abc"),
    });
    await client.history("room-7", { before: 100, limit: 50 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://realtime.useportal.co/v1/channels/room-7/history?before=100&limit=50",
    );
  });

  it("members() → GET the realtime host, not the api host", async () => {
    stubFetch({ members: [] });
    const client = createFetchHttpClient({
      httpUrl: "https://realtime.useportal.co",
      apiKey: "pk_test",
      token: () => Promise.resolve("jwt-abc"),
    });
    await client.members("room-7", "cursor-1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://realtime.useportal.co/v1/channels/room-7/members?cursor=cursor-1",
    );
  });

  it("mintAnonymousToken() → POST the api host, not the realtime host", async () => {
    stubFetch({ token: "jwt-anon" });
    const client = createFetchHttpClient({
      httpUrl: "https://api.useportal.co",
      apiKey: "pk_test",
      token: () => Promise.reject(new Error("the mint route does not use a bearer token")),
    });
    await client.mintAnonymousToken();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.useportal.co/v1/tokens/anonymous");
  });
});
