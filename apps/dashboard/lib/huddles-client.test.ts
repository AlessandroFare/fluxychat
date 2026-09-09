import { describe, expect, it } from "vitest";
import { unwrapSfuResult } from "./huddles-client";

describe("unwrapSfuResult", () => {
  it("reads the Worker proxy envelope", () => {
    expect(unwrapSfuResult({ ok: true, data: { sessionId: "ses_1" } })).toEqual({
      sessionId: "ses_1",
    });
  });

  it("throws when the SFU call failed", () => {
    expect(() => unwrapSfuResult({ ok: false, error: "sfu_upstream" })).toThrow(/sfu_upstream/);
  });
});
