import {
  createNativeWebSocketTransport,
  createPartySocketTransport,
} from "./partysocket-transport.js";
import type { SocketFactory } from "./types.js";

/** Production default: native WebSocket (partysocket when opted in per connection). */
let activeNativeFactory: SocketFactory = createNativeWebSocketTransport();
let activePartyFactory: SocketFactory = createPartySocketTransport();

export function getNativeSocketFactory(): SocketFactory {
  return activeNativeFactory;
}

export function getPartySocketFactory(): SocketFactory {
  return activePartyFactory;
}

/** Test seam — restore defaults with {@link resetSocketFactories}. */
export function setNativeSocketFactory(factory: SocketFactory): void {
  activeNativeFactory = factory;
}

export function setPartySocketFactory(factory: SocketFactory): void {
  activePartyFactory = factory;
}

export function resetSocketFactories(): void {
  activeNativeFactory = createNativeWebSocketTransport();
  activePartyFactory = createPartySocketTransport();
}

export function resolveSocketFactory(usePartySocket: boolean): SocketFactory {
  return usePartySocket ? activePartyFactory : activeNativeFactory;
}
