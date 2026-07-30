import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, assert } from "vitest";
// Could import any other source file/function here
import api_worker from "../src/router";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Hello World worker", () => {
  it("homepage responds with room-name-form", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();

    assert(api_worker);
    assert(api_worker.fetch);

    const response = await api_worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response !== undefined && await response.text()).
      toMatch(/.*id="room-name-form".*/);
  });
});
