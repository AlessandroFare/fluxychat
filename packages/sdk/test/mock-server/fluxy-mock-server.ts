import { parseInboundWsFrame } from "@fluxy-chat/protocol";

export interface MockFluxyRoomClient {
  send(raw: string): void;
  close(): void;
}

export interface MockFluxyRoomServerOptions {
  roomId: string;
  onFrame?: (frame: Record<string, unknown>) => void;
}

/**
 * Minimal in-process room socket mock for SDK/protocol conformance tests.
 * No real network — validates outbound JSON and emits synthetic inbound frames.
 */
export function createMockFluxyRoomServer(
  options: MockFluxyRoomServerOptions,
): {
  accept(): MockFluxyRoomClient;
  getLastOutbound(): Record<string, unknown> | null;
} {
  let lastOutbound: Record<string, unknown> | null = null;
  let clientSend: ((raw: string) => void) | null = null;

  return {
    accept() {
      return {
        send(raw: string) {
          try {
            lastOutbound = JSON.parse(raw) as Record<string, unknown>;
            options.onFrame?.(lastOutbound);
          } catch {
            lastOutbound = null;
          }
        },
        close() {
          clientSend = null;
        },
      };
    },
    getLastOutbound() {
      return lastOutbound;
    },
    /** @internal test hook */
    _emitToClient(raw: string) {
      clientSend?.(raw);
    },
    _bindClient(handler: (raw: string) => void) {
      clientSend = handler;
    },
  } as ReturnType<typeof createMockFluxyRoomServer> & {
    _emitToClient(raw: string): void;
    _bindClient(handler: (raw: string) => void): void;
  };
}

export function parseFluxyInbound(raw: string) {
  return parseInboundWsFrame(raw);
}
