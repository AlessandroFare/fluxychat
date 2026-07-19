import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Portal } from "@portalsdk/core";

import { PortalProvider } from "../src/index.js";

afterEach(cleanup);

type TokenArg = string | (() => string | Promise<string>) | undefined;

function makeClient(): { client: Portal; setToken: ReturnType<typeof vi.fn> } {
  const setToken = vi.fn();
  const client = { setToken } as unknown as Portal;
  return { client, setToken };
}

describe("PortalProvider token pass-through", () => {
  it("forwards a string token on mount", () => {
    const { client, setToken } = makeClient();
    render(
      <PortalProvider client={client} token="jwt-a">
        <span />
      </PortalProvider>,
    );
    expect(setToken).toHaveBeenCalledTimes(1);
    expect(setToken).toHaveBeenCalledWith("jwt-a");
  });

  it("leaves the client's own credential untouched when no token prop is given", () => {
    const { client, setToken } = makeClient();
    render(
      <PortalProvider client={client}>
        <span />
      </PortalProvider>,
    );
    expect(setToken).not.toHaveBeenCalled();
  });

  it("re-forwards only on a meaningful string change", () => {
    const { client, setToken } = makeClient();
    const { rerender } = render(
      <PortalProvider client={client} token="jwt-a">
        <span />
      </PortalProvider>,
    );
    rerender(
      <PortalProvider client={client} token="jwt-a">
        <span />
      </PortalProvider>,
    );
    expect(setToken).toHaveBeenCalledTimes(1); // unchanged value → no re-forward

    rerender(
      <PortalProvider client={client} token="jwt-b">
        <span />
      </PortalProvider>,
    );
    expect(setToken).toHaveBeenCalledTimes(2);
    expect(setToken).toHaveBeenLastCalledWith("jwt-b");
  });

  it("does not reconnect when a new inline callback identity arrives each render", async () => {
    const { client, setToken } = makeClient();
    const { rerender } = render(
      <PortalProvider client={client} token={() => "t1"}>
        <span />
      </PortalProvider>,
    );
    expect(setToken).toHaveBeenCalledTimes(1);
    const forwarded = setToken.mock.calls[0]?.[0] as () => string | Promise<string>;

    // Fresh inline arrows on subsequent renders must not re-forward.
    rerender(
      <PortalProvider client={client} token={() => "t2"}>
        <span />
      </PortalProvider>,
    );
    rerender(
      <PortalProvider client={client} token={() => "t3"}>
        <span />
      </PortalProvider>,
    );
    expect(setToken).toHaveBeenCalledTimes(1);

    // The single forwarded wrapper always resolves the latest callback.
    expect(await forwarded()).toBe("t3");
  });

  it("forwards login then logout transitions", () => {
    const { client, setToken } = makeClient();
    const props = (token: TokenArg) => (
      <PortalProvider client={client} token={token}>
        <span />
      </PortalProvider>
    );
    const { rerender } = render(props(undefined));
    expect(setToken).not.toHaveBeenCalled(); // never engaged

    rerender(props("jwt")); // login
    expect(setToken).toHaveBeenLastCalledWith("jwt");

    rerender(props(undefined)); // logout → anonymous
    expect(setToken).toHaveBeenLastCalledWith(undefined);
    expect(setToken).toHaveBeenCalledTimes(2);
  });
});
