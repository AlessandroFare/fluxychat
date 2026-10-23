import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluxyChatClient } from "./fluxy-chat-client";

/**
 * Contract test for the guest-first 30s path. Pins the wire shape against the
 * worker route `POST /public/rooms/:roomId/guest-session`
 * (apps/worker/src/routes/public-http.js) so SDK and Worker cannot drift.
 */
describe("FluxyChatClient.joinPublicRoomAsGuest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sessionResponse() {
    return new Response(
      JSON.stringify({
        token: "guest.jwt",
        userId: "guest_0123456789abcdef012345",
        roomId: "lobby",
        projectId: "proj-1",
        expiresIn: 3600,
        readOnly: false,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  it("POSTs to the guest-session route with the publishable key and body", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(sessionResponse());
    const session = await FluxyChatClient.joinPublicRoomAsGuest(
      "https://api.fluxychat.com/",
      "lobby",
      {
        displayName: "Ada",
        publishableKey: "pk_test",
        guestKey: "guestkey-abcdefghij123456",
        turnstileToken: "ts-token",
        shareToken: "a".repeat(48),
      },
    );
    expect(session.userId).toBe("guest_0123456789abcdef012345");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.fluxychat.com/public/rooms/lobby/guest-session");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Fluxy-Api-Key"]).toBe("pk_test");
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: "Ada",
      turnstileToken: "ts-token",
      guestKey: "guestkey-abcdefghij123456",
      shareToken: "a".repeat(48),
    });
  });

  it("omits the key header without a publishable key and mints a well-formed guestKey", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(sessionResponse());
    await FluxyChatClient.joinPublicRoomAsGuest("https://api.fluxychat.com", "lobby");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.fluxychat.com/public/rooms/lobby/guest-session");
    expect((init.headers as Record<string, string>)["X-Fluxy-Api-Key"]).toBeUndefined();
    const body = JSON.parse(String(init.body));
    expect(body.guestKey).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });

  it("encodes the room id", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(sessionResponse());
    await FluxyChatClient.joinPublicRoomAsGuest("https://api.fluxychat.com", "team main");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.fluxychat.com/public/rooms/team%20main/guest-session");
  });

  it("throws with the status on failure", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(
      FluxyChatClient.joinPublicRoomAsGuest("https://api.fluxychat.com", "lobby"),
    ).rejects.toThrow(/403/);
  });
});

describe("FluxyChatClient.linkGuestAccount", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the guest token with the caller bearer and returns the transfer counts", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          guestUserId: "guest_0123456789abcdef012345",
          targetUserId: "u_target",
          roomsTransferred: 2,
          roomsAlreadyMember: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new FluxyChatClient({
      baseUrl: "https://api.fluxychat.com/",
      userId: "u_target",
      token: "member.jwt",
    });
    const result = await client.linkGuestAccount("guest.jwt");
    expect(result).toMatchObject({
      ok: true,
      guestUserId: "guest_0123456789abcdef012345",
      roomsTransferred: 2,
      roomsAlreadyMember: 1,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.fluxychat.com/tokens/link-guest");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer member.jwt");
    expect(JSON.parse(String(init.body))).toEqual({ guestToken: "guest.jwt" });
  });

  it("throws with the worker error code on failure", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "guest_already_linked" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new FluxyChatClient({
      baseUrl: "https://api.fluxychat.com",
      userId: "u_target",
      token: "member.jwt",
    });
    await expect(client.linkGuestAccount("guest.jwt")).rejects.toThrow("guest_already_linked");
  });
});
