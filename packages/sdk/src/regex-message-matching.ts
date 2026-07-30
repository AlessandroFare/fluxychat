import type { FluxyChatEvent, FluxyChatMessage } from "./index";

export type MessagePatternHandler = (
  message: FluxyChatMessage,
  match: RegExpExecArray,
) => void | Promise<void>;

export interface MessagePatternRule {
  pattern: RegExp;
  handler: MessagePatternHandler;
  label?: string;
  description?: string;
}

export interface MessagePatternMatcher {
  onNewMessage(
    pattern: RegExp,
    handler: MessagePatternHandler,
    options?: { label?: string; description?: string },
  ): void;
  removeHandler(pattern: RegExp, handler: MessagePatternHandler): boolean;
  match(event: FluxyChatEvent): number;
  getPatterns(): readonly MessagePatternRule[];
  clear(): void;
}

export function createMessagePatternMatcher(): MessagePatternMatcher {
  const rules: MessagePatternRule[] = [];

  const matcher: MessagePatternMatcher = {
    onNewMessage(pattern, handler, options) {
      rules.push({
        pattern,
        handler,
        label: options?.label,
        description: options?.description,
      });
    },

    removeHandler(pattern, handler) {
      const idx = rules.findIndex(
        (r) => r.pattern.source === pattern.source && r.pattern.flags === pattern.flags && r.handler === handler,
      );
      if (idx === -1) return false;
      rules.splice(idx, 1);
      return true;
    },

    match(event) {
      if (event.type !== "message") return 0;
      const message = event as FluxyChatEvent & { type: "message" };
      let matched = 0;
      for (const rule of rules) {
        const m = rule.pattern.exec(message.content);
        if (m) {
          matched++;
          const result = rule.handler(message, m);
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch(() => {});
          }
        }
      }
      return matched;
    },

    getPatterns() {
      return rules as readonly MessagePatternRule[];
    },

    clear() {
      rules.length = 0;
    },
  };

  return matcher;
}
