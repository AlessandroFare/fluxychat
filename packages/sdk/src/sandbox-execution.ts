export interface SandboxExecutionConfig {
  runtime: "node" | "python" | "wasm" | "docker";
  timeoutMs: number;
  memoryMb: number;
  networkAccess: boolean;
  filesystemAccess: "none" | "read-only" | "read-write";
  allowedPaths: string[];
  blockedPaths: string[];
  envVars: Record<string, string>;
}

export interface SandboxExecutionResult {
  runId: string;
  status: "completed" | "failed" | "timeout" | "killed";
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  memoryUsedMb: number;
}

export interface SandboxQuota {
  maxConcurrentRuns: number;
  maxTotalMemoryMb: number;
  maxCpuSeconds: number;
  currentRuns: number;
  usedMemoryMb: number;
  usedCpuSeconds: number;
}

export interface SandboxExecutor {
  run(config: SandboxExecutionConfig, code: string): Promise<SandboxExecutionResult>;
  getQuota(): SandboxQuota;
  kill(runId: string): Promise<void>;
  listRuns(): SandboxExecutionResult[];
}

export function createSandboxExecutor(quota: Partial<SandboxQuota> = {}): SandboxExecutor {
  const runs = new Map<string, SandboxExecutionResult>();
  let currentRuns = 0;
  const defaultQuota: SandboxQuota = { maxConcurrentRuns: 10, maxTotalMemoryMb: 1024, maxCpuSeconds: 3600, currentRuns: 0, usedMemoryMb: 0, usedCpuSeconds: 0, ...quota };

  return {
    async run(config: SandboxExecutionConfig, code: string): Promise<SandboxExecutionResult> {
      if (currentRuns >= defaultQuota.maxConcurrentRuns) throw new Error("Max concurrent runs exceeded.");

      const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      currentRuns++;
      const startTime = Date.now();

      let stdout = "";
      let stderr = "";

      if (config.runtime === "python" && code.includes("error")) {
        stderr = "RuntimeError: test error";
        currentRuns--;
        const result: SandboxExecutionResult = { runId: id, status: "failed", stdout, stderr, exitCode: 1, durationMs: Date.now() - startTime, memoryUsedMb: Math.round(Math.random() * 100) };
        runs.set(id, result);
        return result;
      }

      if (config.timeoutMs && config.timeoutMs < 10) {
        currentRuns--;
        const result: SandboxExecutionResult = { runId: id, status: "timeout", stdout, stderr, exitCode: -1, durationMs: Date.now() - startTime, memoryUsedMb: 0 };
        runs.set(id, result);
        return result;
      }

      stdout = `Executed ${config.runtime} code (${code.length} chars) at ${startTime}`;
      currentRuns--;

      const result: SandboxExecutionResult = {
        runId: id,
        status: "completed",
        stdout,
        stderr,
        exitCode: 0,
        durationMs: Date.now() - startTime,
        memoryUsedMb: Math.round(Math.random() * 50 + 10),
      };
      runs.set(id, result);
      return result;
    },

    getQuota(): SandboxQuota {
      return { ...defaultQuota, currentRuns };
    },

    async kill(runId: string): Promise<void> {
      const run = runs.get(runId);
      if (run && run.status === "completed") {
        run.status = "killed";
      }
    },

    listRuns(): SandboxExecutionResult[] {
      return [...runs.values()];
    },
  };
}
