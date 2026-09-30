import { describe, expect, it, vi } from "vitest";
import {
  buildArt50Unsigned,
  persistArt50OnAgentMessage,
  signArt50Mark,
  verifyArt50Mark,
} from "./art-50-mark.js";

describe("art-50-mark", () => {
  it("signs and verifies HMAC marks", async () => {
    const unsigned = buildArt50Unsigned({
      agentId: "bot_1",
      messageId: 42,
      createdAt: "2026-09-28T00:00:00.000Z",
      firstContact: true,
      disclosureLabel: "Support (AI)",
    });
    const signed = await signArt50Mark("test-secret", unsigned);
    expect(signed.participantType).toBe("ai");
    expect(signed.aiGenerated).toBe(true);
    expect(signed.sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyArt50Mark("test-secret", signed)).toBe(true);
    expect(await verifyArt50Mark("other", signed)).toBe(false);
  });

  it("verifies marks with the previous HMAC key", async () => {
    const unsigned = buildArt50Unsigned({
      agentId: "bot_1",
      messageId: 7,
      createdAt: "2026-09-28T00:00:00.000Z",
    });
    const signed = await signArt50Mark("old-secret", unsigned);
    const { verifyArt50MarkWithRotation } = await import("./art-50-mark.js");
    expect(
      await verifyArt50MarkWithRotation(
        { ART50_MARK_SECRET: "new-secret", ART50_MARK_SECRET_PREVIOUS: "old-secret" },
        signed,
      ),
    ).toBe(true);
  });

  it("persists participant_type and metadata_json", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const env = {
      JWT_SECRET: "test-secret",
      DB: {
        prepare: vi.fn((sql) => ({
          bind: (...args) => ({
            first: async () => (String(sql).includes("SELECT id FROM messages") ? null : null),
            run: async () => {
              run(sql, args);
              return { success: true };
            },
          }),
        })),
      },
    };
    const marked = await persistArt50OnAgentMessage(env, {
      projectId: "p1",
      roomId: "r1",
      messageId: 9,
      agentId: "bot_1",
      createdAt: "2026-09-28T00:00:00.000Z",
      extraMetadata: { aiDisclosure: "Bot (AI)", euAiActRiskCategory: "limited" },
    });
    expect(marked.participantType).toBe("ai");
    expect(marked.firstContactInRoom).toBe(true);
    expect(run).toHaveBeenCalled();
    const updateSql = run.mock.calls[0][0];
    expect(updateSql).toContain("participant_type");
  });
});
