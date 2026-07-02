/**
 * P22-F10: Structured logger with child loggers.
 * Console-based logger with prefix support and child logger creation.
 */

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(prefix = "app") {
    this.prefix = prefix;
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log(`[${this.prefix}] ${message}`, data ?? "");
  }

  error(message: string, data?: Record<string, unknown>): void {
    console.error(`[${this.prefix}] ${message}`, data ?? "");
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(`[${this.prefix}] ${message}`, data ?? "");
  }

  debug(message: string, data?: Record<string, unknown>): void {
    console.debug(`[${this.prefix}] ${message}`, data ?? "");
  }

  child(context: Record<string, unknown>): Logger {
    const childPrefix = Object.entries(context)
      .map(([k, v]) => `${k}=${v}`)
      .join(".");
    return new ConsoleLogger(`${this.prefix}.${childPrefix}`);
  }
}

export function createLogger(prefix?: string): Logger {
  return new ConsoleLogger(prefix);
}
