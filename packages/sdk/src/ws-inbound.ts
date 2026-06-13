import { dispatchInboundWsFrame as dispatchFrame } from "@fluxychat/protocol";
import type { FluxyChatEvent, FluxyChatMessage } from "./index";

interface InboundHandlers {
  onPong: () => void;
  onReplay: (messages: FluxyChatMessage[]) => void;
  onHistoryMarker: () => void;
  onWorkerError: (message?: string) => void;
  onDeliver: (event: FluxyChatEvent) => void;
}

/** Typed wrapper around @fluxychat/protocol dispatch. */
export function dispatchInboundWsFrame(raw: string, handlers: InboundHandlers): void {
  dispatchFrame(raw, {
    onPong: handlers.onPong,
    onReplay: (messages: unknown[]) => handlers.onReplay(messages as FluxyChatMessage[]),
    onHistoryMarker: handlers.onHistoryMarker,
    onWorkerError: handlers.onWorkerError,
    onEvent: (event: Record<string, unknown>) => handlers.onDeliver(event as FluxyChatEvent),
  });
}
