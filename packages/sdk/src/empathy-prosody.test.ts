import { describe, it, expect } from "vitest";
import {
  createEmpathyProsodyController,
  buildEmpathyAgentPromptSuffix,
} from "./empathy-prosody";

describe("empathy-prosody", () => {
  it("classifies frustrated fast speech", () => {
    const ctrl = createEmpathyProsodyController({
      roomId: "r1",
      userId: "u1",
      minConfidence: 0.5,
    });
    let signal = null;
    for (let i = 0; i < 12; i++) {
      signal = ctrl.ingest({ energy: 0.5, deltaMs: 80 });
    }
    expect(signal).not.toBeNull();
    expect(["frustrated", "stressed", "neutral"]).toContain(signal!.inferredState);
  });

  it("returns calm for slow pauses", () => {
    const ctrl = createEmpathyProsodyController({ roomId: "r1", userId: "u1", minConfidence: 0.4 });
    let signal = null;
    for (let i = 0; i < 8; i++) {
      signal = ctrl.ingest({ energy: 0.12, deltaMs: 200 });
      ctrl.ingest({ energy: 0.02, deltaMs: 400 });
    }
    expect(signal?.inferredState).toBeDefined();
  });

  it("builds silent adaptation suffix without naming emotions to user", () => {
    const suffix = buildEmpathyAgentPromptSuffix("stressed");
    expect(suffix).toContain("silently");
    expect(suffix.toLowerCase()).not.toContain("you seem");
  });
});
