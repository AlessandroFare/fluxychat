import { describe, expect, it } from "vitest";
import { isShareableToken, publicShareHref, publicSharePath } from "./public-share-url";

describe("publicShareHref", () => {
  it("does not put keys on the path", () => {
    const token = "ab".repeat(24);
    expect(publicSharePath(token)).toBe(`/share/${token}`);
    expect(publicShareHref("https://fluxychat.com", token)).toBe(
      `https://fluxychat.com/share/${token}`,
    );
  });

  it("only adds pk_ as a query param", () => {
    const token = "cd".repeat(24);
    expect(publicShareHref("https://fluxychat.com", token, "pk_live_x")).toBe(
      `https://fluxychat.com/share/${token}?pk=pk_live_x`,
    );
    expect(publicShareHref("https://fluxychat.com", token, "fc_secret")).toBe(
      `https://fluxychat.com/share/${token}`,
    );
  });

  it("rejects short ids as share tokens", () => {
    expect(isShareableToken("")).toBe(false);
    expect(isShareableToken("lobby")).toBe(false);
    expect(isShareableToken("ab".repeat(24))).toBe(true);
  });
});
