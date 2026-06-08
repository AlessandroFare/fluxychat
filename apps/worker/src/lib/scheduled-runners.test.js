import { describe, expect, it, vi } from "vitest";
import {
  SCHEDULED_CRON_DIGEST,
  runScheduledCronJob,
} from "./scheduled-runners.js";

vi.mock("./daily-digest.js", () => ({
  runDailyDigest: vi.fn(async () => ({ ok: true })),
}));

describe("scheduled-runners", () => {
  it("routes digest cron to runDailyDigest", async () => {
    const { runDailyDigest } = await import("./daily-digest.js");
    const result = await runScheduledCronJob({}, SCHEDULED_CRON_DIGEST);
    expect(result.job).toBe("daily_digest");
    expect(runDailyDigest).toHaveBeenCalled();
  });
});
