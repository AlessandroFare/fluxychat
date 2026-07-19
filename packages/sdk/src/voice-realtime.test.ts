import { describe, expect, it } from "vitest";
import {
  createSemanticEOTDetector,
  createBackchannelDetector,
  createBargeInDetector,
} from "./voice-realtime";

describe("semantic EOT detector", () => {
  it("returns continue for incomplete utterances", () => {
    const detector = createSemanticEOTDetector();
    expect(detector.analyze("I think")).toBe("continue");
    expect(detector.analyze("The thing is")).toBe("continue");
  });

  it("returns turn_complete for sentences ending with period", () => {
    const detector = createSemanticEOTDetector();
    expect(detector.analyze("I agree.")).toBe("turn_complete");
  });

  it("returns awaiting_input for questions", () => {
    const detector = createSemanticEOTDetector();
    expect(detector.analyze("What do you think?")).toBe("awaiting_input");
  });

  it("detects prompt indicators", () => {
    const detector = createSemanticEOTDetector();
    expect(detector.analyze("You know?")).toBe("awaiting_input");
    expect(detector.analyze("Right?")).toBe("awaiting_input");
  });

  it("returns continue for empty transcript", () => {
    const detector = createSemanticEOTDetector();
    expect(detector.analyze("")).toBe("continue");
  });

  it("resets state", () => {
    const detector = createSemanticEOTDetector();
    expect(detector.analyze("Done.")).toBe("turn_complete");
    detector.reset();
    expect(detector.analyze("still")).toBe("continue");
  });
});

describe("backchannel detector", () => {
  const fastConfig = { intervalMs: 0, maxIntervalMs: 100, audioThreshold: 0.02, silenceThresholdMs: 0 };

  it("returns null during active speech", () => {
    const detector = createBackchannelDetector(fastConfig);
    expect(detector.analyze(0.05, true)).toBeNull();
  });

  it("returns ack during silence with low audio", () => {
    const detector = createBackchannelDetector(fastConfig);
    detector.analyze(0.05, true);
    const result = detector.analyze(0.01, false);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("ack");
  });

  it("returns interest during silence with audio", () => {
    const detector = createBackchannelDetector(fastConfig);
    detector.analyze(0.05, true);
    const result = detector.analyze(0.1, false);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("interest");
  });

  it("resets state", () => {
    const detector = createBackchannelDetector(fastConfig);
    expect(detector.analyze(0.05, true)).toBeNull();
    const beforeReset = detector.analyze(0.01, false);
    expect(beforeReset).not.toBeNull();
    detector.reset();
    expect(detector.analyze(0.05, true)).toBeNull();
  });
});

describe("barge-in detector", () => {
  it("returns null when AI is not speaking", () => {
    const detector = createBargeInDetector({ enabled: true, threshold: 0.1, debounceMs: 50 });
    expect(detector.analyze(0.5, false)).toBeNull();
  });

  it("detects barge-in when user speaks over AI", () => {
    const detector = createBargeInDetector({ enabled: true, threshold: 0.1, debounceMs: 50 });
    expect(detector.analyze(0.2, true)).toBeNull();
    expect(detector.analyze(0.3, true)).toBeNull();
    const result = detector.analyze(0.4, true);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("barge_in");
    expect(result!.audioLevel).toBeGreaterThan(0);
  });

  it("does not trigger on low audio", () => {
    const detector = createBargeInDetector({ enabled: true, threshold: 0.5, debounceMs: 50 });
    for (let i = 0; i < 5; i++) {
      expect(detector.analyze(0.1, true)).toBeNull();
    }
  });

  it("resets state", () => {
    const detector = createBargeInDetector({ enabled: true, threshold: 0.1, debounceMs: 50 });
    for (let i = 0; i < 3; i++) detector.analyze(0.5, true);
    detector.reset();
    expect(detector.analyze(0.5, true)).toBeNull();
  });
});
