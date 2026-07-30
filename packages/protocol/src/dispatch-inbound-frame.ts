import { parseInboundWsFrame } from "./parse-inbound-frame.js";
import type { UnknownWsFrame } from "./unknown-frame.js";

export interface InboundDispatchHandlers {
  onPong: () => void;
  onReplay: (messages: unknown[]) => void;
  onHistoryMarker: () => void;
  onWorkerError: (message?: string) => void;
  onEvent: (event: Record<string, unknown>) => void;
  /** Forward-compatible unknown frame (Portal §6 passthrough). */
  onUnknownFrame?: (frame: UnknownWsFrame) => void;
}

/** Shared WS frame dispatch for all FluxyChat client SDKs. */
export function dispatchInboundWsFrame(raw: string, handlers: InboundDispatchHandlers): void {
  const frame = parseInboundWsFrame(raw);
  if (!frame) return;

  if (frame.kind === "pong") {
    handlers.onPong();
    return;
  }

  if (frame.kind === "replay") {
    handlers.onReplay(frame.messages ?? []);
    return;
  }

  if (frame.kind === "unknown") {
    if (frame.frame) handlers.onUnknownFrame?.(frame.frame);
    return;
  }

  if (frame.kind !== "event") return;

  const event = frame.event;
  if (!event || typeof event.type !== "string") return;

  if (event.type === "history") {
    handlers.onHistoryMarker();
  }

  if (event.type === "error") {
    handlers.onWorkerError(typeof event.message === "string" ? event.message : undefined);
  }

  handlers.onEvent(event);
}
