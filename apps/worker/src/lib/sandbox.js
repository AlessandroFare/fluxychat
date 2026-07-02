/**
 * P23-7: Sandbox Support — Worker Implementation
 * Isolated code execution for agent tool calls.
 */

/**
 * Create a sandbox manager.
 */
export function createSandboxManager() {
  const sandboxes = new Map();

  return {
    async create(config = {}) {
      const id = crypto.randomUUID();
      const sandbox = {
        id,
        status: "running",
        config: {
          name: config.name || `sandbox-${id.slice(0, 8)}`,
          runtime: config.runtime || "node",
          timeoutMs: config.timeoutMs || 30_000,
          memoryMb: config.memoryMb || 128,
          networkAccess: config.networkAccess || false,
          filesystemAccess: config.filesystemAccess || "read-only",
          env: config.env || {},
          workDir: config.workDir || "/tmp",
        },
        _files: new Map(),
        _processes: new Map(),

        async execute(code, language = "javascript") {
          if (this.status !== "running") throw new Error("Sandbox is not running");
          const startTime = performance.now();

          // Sandboxed code execution via eval-like isolation
          // In production, this would use VM2, isolated-vm, or a container
          try {
            const timeoutMs = this.config.timeoutMs;
            const result = await Promise.race([
              runSandboxed(code, language, this.config),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Execution timed out")), timeoutMs)
              ),
            ]);

            return {
              stdout: result.stdout || "",
              stderr: result.stderr || "",
              exitCode: result.exitCode || 0,
              durationMs: Math.round(performance.now() - startTime),
              files: result.files,
            };
          } catch (err) {
            return {
              stdout: "",
              stderr: err.message,
              exitCode: 1,
              durationMs: Math.round(performance.now() - startTime),
            };
          }
        },

        async exec(command, args = []) {
          if (this.status !== "running") throw new Error("Sandbox is not running");
          return this.execute(`${command} ${args.join(" ")}`, "shell");
        },

        async writeFile(path, content) {
          if (this.status !== "running") throw new Error("Sandbox is not running");
          if (this.config.filesystemAccess === "none") throw new Error("Filesystem access denied");
          this._files.set(path, content);
        },

        async readFile(path) {
          if (this.status !== "running") throw new Error("Sandbox is not running");
          if (!this._files.has(path)) throw new Error(`File not found: ${path}`);
          return this._files.get(path);
        },

        async listFiles(dir = "/") {
          if (this.status !== "running") throw new Error("Sandbox is not running");
          return [...this._files.keys()].filter((p) => p.startsWith(dir));
        },

        async stop() {
          this.status = "stopped";
          this._files.clear();
          this._processes.clear();
        },

        isRunning() {
          return this.status === "running";
        },
      };

      sandboxes.set(id, sandbox);
      return sandbox;
    },

    get(id) {
      return sandboxes.get(id) || null;
    },

    list() {
      return [...sandboxes.values()];
    },

    async remove(id) {
      const sandbox = sandboxes.get(id);
      if (sandbox) {
        await sandbox.stop();
        sandboxes.delete(id);
      }
    },

    async stopAll() {
      for (const [, sandbox] of sandboxes) {
        await sandbox.stop();
      }
      sandboxes.clear();
    },
  };
}

/**
 * Run code in a sandboxed environment.
 * @param {string} code
 * @param {string} language
 * @param {Object} config
 */
async function runSandboxed(code, language, config) {
  // Simplified sandboxed execution
  // In production, use isolated-vm, VM2, or a container runtime
  const stdout = [];
  const stderr = [];

  const sandboxConsole = {
    log: (...args) => stdout.push(args.map(String).join(" ")),
    error: (...args) => stderr.push(args.map(String).join(" ")),
    warn: (...args) => stdout.push("[WARN] " + args.map(String).join(" ")),
  };

  try {
    if (language === "javascript" || language === "js") {
      const fn = new Function("console", "setTimeout", "fetch", code);
      const result = fn(sandboxConsole, () => {}, () => Promise.reject(new Error("Network access denied")));
      if (result instanceof Promise) await result;
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }
  } catch (err) {
    stderr.push(err.message);
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    exitCode: stderr.length > 0 ? 1 : 0,
  };
}

/**
 * Execute code in a temporary sandbox (convenience function).
 * @param {string} code
 * @param {Object} opts
 */
export async function executeInSandbox(code, opts = {}) {
  const manager = createSandboxManager();
  const sandbox = await manager.create(opts.config || {});
  try {
    return await sandbox.execute(code, opts.language);
  } finally {
    await sandbox.stop();
  }
}
