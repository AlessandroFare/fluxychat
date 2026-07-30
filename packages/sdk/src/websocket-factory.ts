import { resolveSocketFactory } from "./transport/factory.js";
import { createFluxyWebSocketFromFactory } from "./transport/partysocket-transport.js";

/**
 * Create a browser WebSocket for Fluxy room/user channels.
 * When `usePartySocket` is true, uses the partysocket-backed transport factory.
 */
export function createFluxyWebSocket(url: string, usePartySocket = false): WebSocket {
  return createFluxyWebSocketFromFactory(url, usePartySocket, resolveSocketFactory(usePartySocket));
}

export {
  getNativeSocketFactory,
  getPartySocketFactory,
  resetSocketFactories,
  resolveSocketFactory,
  setNativeSocketFactory,
  setPartySocketFactory,
} from "./transport/factory.js";
export type { SocketFactory } from "./transport/types.js";
