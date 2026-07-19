import { describe, it, expect } from "vitest";
import { createSandboxExecutor } from "./sandbox-execution";

describe("sandbox-execution", () => {
  it("should execute code successfully", async () => {
    const ex = createSandboxExecutor();
    const result = await ex.run({ runtime: "node", timeoutMs: 5000, memoryMb: 128, networkAccess: false, filesystemAccess: "none", allowedPaths: [], blockedPaths: [], envVars: {} }, "console.log('hello')");
    expect(result.status).toBe("completed");
    expect(result.exitCode).toBe(0);
  });

  it("should report execution failure", async () => {
    const ex = createSandboxExecutor();
    const result = await ex.run({ runtime: "python", timeoutMs: 5000, memoryMb: 128, networkAccess: false, filesystemAccess: "none", allowedPaths: [], blockedPaths: [], envVars: {} }, "raise error('test')");
    expect(result.status).toBe("failed");
  });

  it("should timeout on short timeout", async () => {
    const ex = createSandboxExecutor();
    const result = await ex.run({ runtime: "node", timeoutMs: 1, memoryMb: 128, networkAccess: false, filesystemAccess: "none", allowedPaths: [], blockedPaths: [], envVars: {} }, "while(true){}");
    expect(result.status).toBe("timeout");
  });

  it("should track quota", async () => {
    const ex = createSandboxExecutor({ maxConcurrentRuns: 5, maxTotalMemoryMb: 512, maxCpuSeconds: 1800 });
    const quota = ex.getQuota();
    expect(quota.maxConcurrentRuns).toBe(5);
    expect(quota.maxTotalMemoryMb).toBe(512);
  });

  it("should list completed runs", async () => {
    const ex = createSandboxExecutor();
    await ex.run({ runtime: "node", timeoutMs: 5000, memoryMb: 64, networkAccess: false, filesystemAccess: "none", allowedPaths: [], blockedPaths: [], envVars: {} }, "test");
    expect(ex.listRuns()).toHaveLength(1);
  });

  it("should kill a run", async () => {
    const ex = createSandboxExecutor();
    const result = await ex.run({ runtime: "node", timeoutMs: 5000, memoryMb: 64, networkAccess: false, filesystemAccess: "none", allowedPaths: [], blockedPaths: [], envVars: {} }, "test");
    await ex.kill(result.runId);
    expect(ex.listRuns()[0].status).toBe("killed");
  });
});
