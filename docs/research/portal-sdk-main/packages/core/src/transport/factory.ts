import { createPartySocketTransport } from "./partysocket.js";
import type { SocketFactory } from "./types.js";

/**
 * The active socket factory. Production uses the `partysocket`-backed transport; tests
 * swap in an in-memory mock via {@link setSocketFactory}.
 *
 * This is an internal test seam — it is NOT re-exported from the package entry point, so
 * it never appears in the public type surface. Tests must restore the default with
 * {@link resetSocketFactory} to avoid bleeding across cases.
 */
let active: SocketFactory = createPartySocketTransport;

export const getSocketFactory = (): SocketFactory => active;

export const setSocketFactory = (factory: SocketFactory): void => {
  active = factory;
};

export const resetSocketFactory = (): void => {
  active = createPartySocketTransport;
};
