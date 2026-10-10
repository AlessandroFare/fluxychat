import { describe, expect, it, vi } from "vitest";
import { createVoiceTokenSource } from "./voice-token-source";

describe("voice token source", () => {
  it("caches until expiry and refetches when grants change", async () => {
    const fetchToken = vi.fn(async (_roomId: string, opts?: { canPublish?: boolean }) => ({
      ok: true,
      token: {
        identity: "u1",
        expiresAt: Date.now() + 120_000,
        canPublish: opts?.canPublish !== false,
      },
    }));
    const source = createVoiceTokenSource(fetchToken);
    await source.fetch("lobby");
    await source.fetch("lobby");
    expect(fetchToken).toHaveBeenCalledTimes(1);
    await source.fetch("lobby", { canPublish: false });
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("force skips the cache", async () => {
    const fetchToken = vi.fn(async () => ({
      ok: true,
      token: { expiresAt: Date.now() + 120_000 },
    }));
    const source = createVoiceTokenSource(fetchToken);
    await source.fetch("lobby");
    await source.fetch("lobby", undefined, true);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
