import { createFetchHttpClient } from "./fetch.js";
import type { HttpClientFactory } from "./types.js";

/**
 * The active HTTP client factory. Production uses `fetch`; tests swap in an in-memory mock.
 *
 * Internal test seam — not re-exported from the package entry point. Tests must restore the
 * default with {@link resetHttpClientFactory}.
 */
let active: HttpClientFactory = createFetchHttpClient;

export const getHttpClientFactory = (): HttpClientFactory => active;

export const setHttpClientFactory = (factory: HttpClientFactory): void => {
  active = factory;
};

export const resetHttpClientFactory = (): void => {
  active = createFetchHttpClient;
};
