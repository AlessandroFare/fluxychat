// Test-only wiring. The react suite drives the hooks against real core over an in-memory
// mock server, so it borrows core's existing mock-server harness and its (non-public)
// transport/HTTP factory seams via relative paths. This never ships — it lives under test/
// and is not reachable from the package entry. Module identity holds because vitest aliases
// `@portalsdk/core` to core's source (see vitest.config.ts), so the Portal under test and
// these seams are the same module instance.
import { resetHttpClientFactory, setHttpClientFactory } from "../../core/src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../../core/src/transport/factory.js";
import { MockHttpClient } from "../../core/test/mock-server/http.js";
import { MockSocketServer } from "../../core/test/mock-server/index.js";

export { MockHttpClient, MockSocketServer };
export type { ConnectContext, ConnectScript } from "../../core/test/mock-server/index.js";

/** Route core's socket + HTTP transport at the given mocks for the duration of a test. */
export function installMocks(
  server: MockSocketServer,
  http: MockHttpClient = new MockHttpClient(),
): MockHttpClient {
  setSocketFactory(server.factory);
  setHttpClientFactory(http.factory);
  return http;
}

/** Restore the real transport factories. Call in `afterEach`. */
export function resetMocks(): void {
  resetSocketFactory();
  resetHttpClientFactory();
}
