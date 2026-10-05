import { describe, expect, it } from "vitest";
import { validateA2uiSurface } from "./a2ui-catalog.js";

describe("a2ui-catalog", () => {
  it("rejects unknown component types", () => {
    expect(validateA2uiSurface({ components: [{ type: "iframe" }] }).ok).toBe(false);
  });

  it("requires action ids on buttons and keeps quorum flags", () => {
    const ok = validateA2uiSurface({
      components: [
        { type: "Text", props: { body: "Approve wire?" } },
        { type: "Button", actionId: "ack_wire", attributedUserId: "u1", requireQuorum: true, requiredAcks: 2 },
      ],
    });
    expect(ok.ok).toBe(true);
    expect(ok.actions[0].requireQuorum).toBe(true);
    expect(ok.actions[0].requiredAcks).toBe(2);
  });
});
