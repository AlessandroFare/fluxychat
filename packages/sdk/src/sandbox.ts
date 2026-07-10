/**
 * P23-7: Sandbox Support
 * Isolated code execution for agent tool calls.
 */

export type SandboxStatus = "creating" | "running" | "stopped" | "failed" | "timeout";

export interface SandboxConfig {
  /** Sandbox name */
  name?: string;
  /** Runtime to use (e.g., "node", "python", "wasm") */
  runtime?: "node" | "python" | "wasm" | "docker";
  /** Maximum execution time in milliseconds */
  timeoutMs?: number;
  /** Maximum memory in MB */
  memoryMb?: number;
  /** Network access (default: disabled) */
  networkAccess?: boolean;
  /** File system access (default: read-only) */
  filesystemAccess?: "none" | "read-only" | "read-write";
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  workDir?: string;
}

export interface SandboxExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  files?: Array<{ path: string; content: string }>;
}

export interface Sandbox {
  id: string;
  status: SandboxStatus;
  config: SandboxConfig;
  /** Execute code in the sandbox */
  execute(code: string, language?: string): Promise<SandboxExecutionResult>;
  /** Execute a command in the sandbox */
  exec(command: string, args?: string[]): Promise<SandboxExecutionResult>;
  /** Write a file to the sandbox */
  writeFile(path: string, content: string): Promise<void>;
  /** Read a file from the sandbox */
  readFile(path: string): Promise<string>;
  /** List files in the sandbox */
  listFiles(dir?: string): Promise<string[]>;
  /** Stop the sandbox */
  stop(): Promise<void>;
  /** Check if the sandbox is still running */
  isRunning(): boolean;
}

export interface SandboxManager {
  /** Create a new sandbox */
  create(config?: SandboxConfig): Promise<Sandbox>;
  /** Get an existing sandbox */
  get(id: string): Sandbox | null;
  /** List all sandboxes */
  list(): Sandbox[];
  /** Stop and remove a sandbox */
  remove(id: string): Promise<void>;
  /** Stop all sandboxes */
  stopAll(): Promise<void>;
}

export function createSandboxManager(): SandboxManager {
  throw new Error("createSandboxManager not implemented in SDK - use worker runtime");
}

/**
 * Execute code in a temporary sandbox (convenience function).
 */
export function executeInSandbox(
  code: string,
  opts?: { language?: string; timeoutMs?: number; config?: SandboxConfig },
): Promise<SandboxExecutionResult> {
  throw new Error("executeInSandbox not implemented in SDK - use worker runtime");
}
