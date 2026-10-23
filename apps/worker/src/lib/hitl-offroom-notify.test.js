import { describe, expect, it, vi } from "vitest";
import { isOperatorSlackWebhookUrl, notifyHitlOffRoom } from "./hitl-offroom-notify.js";
import { signHitlTapToken, verifyHitlTapToken } from "./hitl-tap-token.js";
import { sendDigestEmail } from "./digest-email.js";

vi.mock("./digest-email.js", () => ({ sendDigestEmail: vi.fn(async () => ({ ok: true })) }));
vi.mock("./daily-digest.js", () => ({
  getDigestPreferences: vi.fn(async () => ({ emailEnabled: true, email: "ops@x.test" })),
}));

describe("hitl off-room notify helpers", () => {
  it("allows only https hooks.slack.com", () => {
    expect(isOperatorSlackWebhookUrl("https://hooks.slack.com/services/T/B/x")).toBe(true);
    expect(isOperatorSlackWebhookUrl("https://evil.example/hooks.slack.com")).toBe(false);
    expect(isOperatorSlackWebhookUrl("http://hooks.slack.com/services/T/B/x")).toBe(false);
  });

  it("signs tap tokens that verify against the same payload bytes", async () => {
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "approve",
      userId: "u1",
      exp: Date.now() + 60_000,
    });
    const parsed = await verifyHitlTapToken("secret", token);
    expect(parsed.userId).toBe("u1");
    expect(await verifyHitlTapToken("wrong", token)).toBeNull();
  });

  it("builds tap links on the Worker origin, falling back to the app origin", async () => {
    const base = {
      ART50_MARK_SECRET: "secret",
      PUBLIC_APP_URL: "https://app.example",
      WORKER_PUBLIC_URL: "https://api.example",
    };
    const input = {
      projectId: "p1",
      roomId: "r1",
      approvalId: "appr_1",
      approverId: "u1",
      toolName: "notify.send",
      toolInput: { message: "hi" },
    };
    const out = await notifyHitlOffRoom(base, input);
    expect(out.approveUrl.startsWith("https://api.example/public/hitl/tap?token=")).toBe(true);
    expect(out.denyUrl.startsWith("https://api.example/public/hitl/tap?token=")).toBe(true);
    expect(String(sendDigestEmail.mock.calls.at(-1)[1].textBody)).toContain("https://api.example/public/hitl/tap");

    const fallback = await notifyHitlOffRoom({ ...base, WORKER_PUBLIC_URL: undefined }, input);
    expect(fallback.approveUrl.startsWith("https://app.example/public/hitl/tap?token=")).toBe(true);
  });
});
