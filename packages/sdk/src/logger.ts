/**
 * Structured logger with child loggers and Ably-style levels.
 */

export type FluxyLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";

const LOG_RANK: Record<FluxyLogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

export interface Logger {
  readonly logLevel: FluxyLogLevel;
  trace(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
  withContext(context: Record<string, unknown>): Logger;
}

export interface CreateLoggerOptions {
  prefix?: string;
  logLevel?: FluxyLogLevel;
}

class ConsoleLogger implements Logger {
  private prefix: string;
  readonly logLevel: FluxyLogLevel;

  constructor(prefix = "app", logLevel: FluxyLogLevel = "info") {
    this.prefix = prefix;
    this.logLevel = logLevel;
  }

  private emit(
    level: Exclude<FluxyLogLevel, "silent">,
    method: "debug" | "log" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (LOG_RANK[level] < LOG_RANK[this.logLevel]) return;
    const line = `[${this.prefix}] ${message}`;
    if (method === "debug") console.debug(line, data ?? "");
    else if (method === "log") console.log(line, data ?? "");
    else if (method === "warn") console.warn(line, data ?? "");
    else console.error(line, data ?? "");
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.emit("trace", "debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.emit("info", "log", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.emit("error", "error", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.emit("warn", "warn", message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.emit("debug", "debug", message, data);
  }

  child(context: Record<string, unknown>): Logger {
    const childPrefix = Object.entries(context)
      .map(([k, v]) => `${k}=${v}`)
      .join(".");
    return new ConsoleLogger(`${this.prefix}.${childPrefix}`, this.logLevel);
  }

  withContext(context: Record<string, unknown>): Logger {
    return this.child(context);
  }
}

export function createLogger(prefixOrOptions?: string | CreateLoggerOptions): Logger {
  if (typeof prefixOrOptions === "object" && prefixOrOptions) {
    return new ConsoleLogger(prefixOrOptions.prefix, prefixOrOptions.logLevel ?? "info");
  }
  return new ConsoleLogger(prefixOrOptions);
}
