import { dispatchInboundWsFrame as dispatchFrame } from "@fluxy-chat/protocol";
import type { UnknownWsFrame } from "@fluxy-chat/protocol";
import type { FluxyChatEvent, FluxyChatMessage } from "./index";

interface InboundHandlers {
  onPong: () => void;
  onReplay: (messages: FluxyChatMessage[]) => void;
  onHistoryMarker: () => void;
  onWorkerError: (message?: string) => void;
  onDeliver: (event: FluxyChatEvent) => void;
  onUnknownFrame?: (frame: UnknownWsFrame) => void;
}

/** Typed wrapper around @fluxy-chat/protocol dispatch. */
export function dispatchInboundWsFrame(raw: string, handlers: InboundHandlers): void {
  dispatchFrame(raw, {
    onPong: handlers.onPong,
    onReplay: (messages: unknown[]) => handlers.onReplay(messages as FluxyChatMessage[]),
    onHistoryMarker: handlers.onHistoryMarker,
    onWorkerError: handlers.onWorkerError,
    onEvent: (event: Record<string, unknown>) => handlers.onDeliver(event as FluxyChatEvent),
    onUnknownFrame: handlers.onUnknownFrame,
  });
}
