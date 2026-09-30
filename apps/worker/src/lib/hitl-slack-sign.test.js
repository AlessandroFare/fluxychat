import { describe, expect, it } from "vitest";
import { hitlSlackActionElements, isHitlApprovalUuid, verifySlackRequestSignature } from "./hitl-slack-sign.js";

describe("verifySlackRequestSignature", () => {
  it("accepts a fresh v0 signature", async () => {
    const signingSecret = "slack-secret";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = "payload=%7B%22type%22%3A%22block_actions%22%7D";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`v0:${timestamp}:${rawBody}`),
    );
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const ok = await verifySlackRequestSignature({
      signingSecret,
      timestamp,
      rawBody,
      signatureHeader: `v0=${hex}`,
    });
    expect(ok).toBe(true);
  });

  it("rejects a stale timestamp", async () => {
    const ok = await verifySlackRequestSignature({
      signingSecret: "x",
      timestamp: String(Math.floor(Date.now() / 1000) - 400),
      rawBody: "payload=x",
      signatureHeader: "v0=deadbeef",
    });
    expect(ok).toBe(false);
  });
});

describe("hitlSlackActionElements", () => {
  it("treats approval UUIDs as mapped button values", () => {
    expect(isHitlApprovalUuid("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
    expect(isHitlApprovalUuid("tokA")).toBe(false);
  });

  it("puts the approval id on buttons when mapped", () => {
    const els = hitlSlackActionElements({
      interactive: true,
      mappedApprovalId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      approveTok: "tokA",
      denyTok: "tokD",
    });
    expect(els[0].value).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(els[1].value).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  it("uses action_id when interactive", () => {
    const els = hitlSlackActionElements({
      interactive: true,
      approveTok: "tokA",
      denyTok: "tokD",
    });
    expect(els[0].action_id).toBe("fluxy_hitl_approve");
    expect(els[0].value).toBe("tokA");
    expect(els[0].url).toBeUndefined();
  });

  it("uses url buttons without signing secret", () => {
    const els = hitlSlackActionElements({
      interactive: false,
      approveUrl: "https://api.example/public/hitl/tap?token=a",
      denyUrl: "https://api.example/public/hitl/tap?token=d",
    });
    expect(els[0].url).toContain("/public/hitl/tap");
  });
});
