import { describe, expect, it } from "vitest";
import {
  backoffMsForFailure,
  classifyDoFailure,
  LAST_WAKE_STORAGE_KEY,
  recordDoWake,
  runDoAlarmStep,
} from "./do-retry-taxonomy.js";

describe("do retry taxonomy", () => {
  it("retries code updates and transients, not OOM", () => {
    expect(
      classifyDoFailure(new Error("Durable Object reset because its code was updated.")).code,
    ).toBe("code_update");
    expect(classifyDoFailure(new Error("Memory limit exceeded")).retry).toBe(false);
    expect(classifyDoFailure(new Error("Network connection lost.")).retry).toBe(true);
    expect(classifyDoFailure(new Error("The operation was aborted")).code).toBe("abort");
  });

  it("backs off retryable failures", () => {
    const c = classifyDoFailure(new Error("fetch failed"));
    expect(backoffMsForFailure(c, 0)).toBe(1_000);
    expect(backoffMsForFailure(c, 3)).toBe(8_000);
    expect(backoffMsForFailure({ retry: false, delayMs: 250 }, 9)).toBe(0);
  });

  it("records wake outcome on DO storage", async () => {
    const bag = new Map();
    const storage = {
      get: async (k) => bag.get(k),
      put: async (k, v) => bag.set(k, v),
    };
    const ok = await runDoAlarmStep({ storage }, async () => 7, { reason: "agent-schedules" });
    expect(ok).toEqual({ ok: true, result: 7 });
    expect(bag.get(LAST_WAKE_STORAGE_KEY).code).toBe("ok");

    const fail = await runDoAlarmStep({ storage }, async () => {
      throw new Error("Network connection lost.");
    });
    expect(fail.ok).toBe(false);
    expect(fail.code).toBe("transient");
    expect(fail.retry).toBe(true);
    await recordDoWake(storage, fail);
    expect(bag.get(LAST_WAKE_STORAGE_KEY).retry).toBe(true);
  });
});
