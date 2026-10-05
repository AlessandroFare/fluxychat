import { describe, expect, it } from "vitest";
import { dsaRestrictionEmail, parseDsaClose, parseDsaReport } from "./dsa-notice.js";

describe("dsa-notice", () => {
  it("requires explanation, https URL, contact, and good faith", () => {
    expect(parseDsaReport({}).ok).toBe(false);
    const ok = parseDsaReport({
      explanation: "This share page hosts illegal content that should be removed promptly.",
      url: "https://fluxychat.com/share/" + "a".repeat(48),
      contact: "reporter@example.com",
      goodFaith: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.report.shareToken).toHaveLength(48);
  });

  it("writes a reasons email without inventing a court order", () => {
    const mail = dsaRestrictionEmail({
      url: "https://fluxychat.com/share/abc",
      reason: "Share token disabled",
      contact: "a@b.c",
    });
    expect(mail.subject).toMatch(/notice/i);
    expect(mail.text).toMatch(/not a court order/i);
  });

  it("requires a written reason to close a notice", () => {
    expect(parseDsaClose({}).ok).toBe(false);
    expect(parseDsaClose({ reason: "Share token disabled after review" }).ok).toBe(true);
  });

  it("revokes a share token without minting a replacement", async () => {
    const { disableShareToken } = await import("./dsa-notice.js");
    const calls = [];
    const env = {
      DB: {
        prepare(sql) {
          calls.push(sql);
          return {
            bind() {
              return { async run() { return { meta: { changes: 1 } }; } };
            },
          };
        },
      },
    };
    const out = await disableShareToken(env, "a".repeat(48));
    expect(out.disabled).toBe(true);
    expect(calls[0]).toMatch(/revoked_at/);
    expect(calls[0]).not.toMatch(/INSERT/i);
  });
});
