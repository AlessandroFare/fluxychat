/**
 * P22-F10: Structured Logger for Worker
 * Console-based logger with child loggers and prefix support.
 */

import { logInfo, logError } from "./worker-log.js";

export function createLogger(prefix = "app") {
  return {
    info(message, data) {
      logInfo(`${prefix}.${message}`, data);
    },
    error(message, data) {
      logError(`${prefix}.${message}`, data);
    },
    warn(message, data) {
      logInfo(`${prefix}.warn.${message}`, data);
    },
    debug(message, data) {
      logInfo(`${prefix}.debug.${message}`, data);
    },
    child(ctx) {
      const childPrefix = Object.entries(ctx)
        .map(([k, v]) => `${k}=${v}`)
        .join(".");
      return createLogger(`${prefix}.${childPrefix}`);
    },
  };
}
