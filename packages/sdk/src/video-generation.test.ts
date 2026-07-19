import { describe, it, expect } from "vitest";
import { createVideoGenerator } from "./video-generation";

describe("video-generation", () => {
  it("should start with no jobs", () => {
    const vg = createVideoGenerator();
    expect(vg.listJobs()).toEqual([]);
  });

  it("should create a job on generate", async () => {
    const vg = createVideoGenerator();
    const id = await vg.generate({ prompt: "a cat playing piano" });
    expect(id).toMatch(/^video-/);
    expect(vg.listJobs()).toHaveLength(1);
  });

  it("should track job progress", async () => {
    const vg = createVideoGenerator();
    const id = await vg.generate({ prompt: "test" });
    const progress = vg.getProgress(id);
    expect(["pending", "processing"]).toContain(progress.status);
  });

  it("should return failed for unknown job", () => {
    const vg = createVideoGenerator();
    const progress = vg.getProgress("no-such-job");
    expect(progress.status).toBe("failed");
    expect(progress.error).toBe("Job not found");
  });

  it("should support multi-jobs", async () => {
    const vg = createVideoGenerator();
    const id1 = await vg.generate({ prompt: "video 1" });
    const id2 = await vg.generate({ prompt: "video 2" });
    expect(vg.listJobs()).toHaveLength(2);
  });

  it("should allow cancel", async () => {
    const vg = createVideoGenerator();
    const id = await vg.generate({ prompt: "test" });
    await vg.cancel(id);
    expect(vg.getProgress(id).status).toBe("cancelled");
  });
});
