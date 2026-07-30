import { WebSocket as ReconnectingWebSocket } from "partysocket";
import type { SocketFactory } from "./types.js";

const PARTYSOCKET_OPTIONS = {
  minReconnectionDelay: 1_000,
  maxReconnectionDelay: 30_000,
  reconnectionDelayGrowFactor: 1.5,
  connectionTimeout: 10_000,
  minUptime: 5_000,
  maxRetries: Number.POSITIVE_INFINITY,
} as const;

export function createNativeWebSocketTransport(): SocketFactory {
  return (url: string) => new WebSocket(url);
}

export function createPartySocketTransport(): SocketFactory {
  return (url: string) =>
    new ReconnectingWebSocket(url, [], PARTYSOCKET_OPTIONS) as unknown as WebSocket;
}

export function createFluxyWebSocketFromFactory(
  url: string,
  usePartySocket: boolean,
  factory?: SocketFactory,
): WebSocket {
  const resolved = factory ?? (usePartySocket ? createPartySocketTransport() : createNativeWebSocketTransport());
  return resolved(url);
}
