import { parseInboundWsFrame } from "./parse-inbound-frame.js";

export interface InboundDispatchHandlers {
  onPong: () => void;
  onReplay: (messages: unknown[]) => void;
  onHistoryMarker: () => void;
  onWorkerError: (message?: string) => void;
  onEvent: (event: Record<string, unknown>) => void;
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

  if (frame.kind === "ignored") return;

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
