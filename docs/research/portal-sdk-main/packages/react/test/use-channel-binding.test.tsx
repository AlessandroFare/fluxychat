import { StrictMode } from "react";
import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotYetSupportedError, PortalError, type Message } from "@portalsdk/core";

import { PortalProvider } from "../src/index.js";
import { useChannel } from "../src/use-channel.js";
import { makeFakePortal, type FakePortal } from "./fakes.js";

function wrapperFor(fake: FakePortal) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PortalProvider client={fake.portal}>{children}</PortalProvider>;
  };
}

function fakeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    channelId: "room",
    sender: { id: "u1", anon: false },
    timestamp: 0,
    retracted: false,
    ephemeral: false,
    kind: "text",
    type: "message",
    content: undefined,
    unread: true,
    status: "sent",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refcount", () => {
  it("acquires on mount and releases on unmount", () => {
    const fake = makeFakePortal();
    const { unmount } = renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: wrapperFor(fake),
    });
    const ch = fake.channel("room");
    expect(ch?.handle.acquire).toHaveBeenCalledTimes(1);
    expect(ch?.handle.release).not.toHaveBeenCalled();

    unmount();
    expect(ch?.handle.release).toHaveBeenCalledTimes(1);
  });

  it("does not acquire while channelId is undefined, then acquires once provided", () => {
    const fake = makeFakePortal();
    const { rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useChannel({ channelId: id }),
      { wrapper: wrapperFor(fake), initialProps: { id: undefined as string | undefined } },
    );
    // Inert: the registry is never consulted for an undefined id.
    expect(fake.channel("room")).toBeUndefined();

    rerender({ id: "room" });
    expect(fake.channel("room")?.handle.acquire).toHaveBeenCalledTimes(1);
  });

  it("on channelId change, releases the old handle and acquires the new", () => {
    const fake = makeFakePortal();
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useChannel({ channelId: id }),
      { wrapper: wrapperFor(fake), initialProps: { id: "room-a" } },
    );
    const a = fake.channel("room-a");
    expect(a?.handle.acquire).toHaveBeenCalledTimes(1);

    rerender({ id: "room-b" });
    const b = fake.channel("room-b");
    expect(a?.handle.release).toHaveBeenCalledTimes(1);
    expect(b?.handle.acquire).toHaveBeenCalledTimes(1);
  });

  it("StrictMode remount nets to acquired (acquire twice, release once)", () => {
    const fake = makeFakePortal();
    renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: wrapperFor(fake),
      reactStrictMode: true,
    });
    const ch = fake.channel("room");
    // mount → acquire, strict unmount → release, strict remount → acquire. Core's grace
    // absorbs the release/re-acquire so no reconnect results; react just pairs the calls.
    expect(ch?.handle.acquire).toHaveBeenCalledTimes(2);
    expect(ch?.handle.release).toHaveBeenCalledTimes(1);
  });
});

describe("store binding", () => {
  it("reflects the handle snapshot and re-renders on change", () => {
    const fake = makeFakePortal();
    const { result } = renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: wrapperFor(fake),
    });
    expect(result.current.status).toBe("connecting");
    expect(result.current.messages).toEqual([]);

    const msg = fakeMessage();
    act(() => {
      fake.channel("room")?.setSnapshot({
        status: "ready",
        messages: [msg],
        unread: 1,
        info: { id: "room", mode: "standard" },
      });
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.messages).toEqual([msg]);
    expect(result.current.unread).toBe(1);
    expect(result.current.channel).toEqual({ id: "room", mode: "standard" });
  });

  it("derives typing from activity of kind 'typing'", () => {
    const fake = makeFakePortal();
    const { result } = renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: wrapperFor(fake),
    });
    act(() => {
      fake.channel("room")?.setSnapshot({
        activity: [
          { userId: "a", kind: "typing", since: 1 },
          { userId: "b", kind: "thinking", since: 2 },
        ],
      });
    });
    expect(result.current.typing).toEqual(["a"]);
  });

  it("renders an inert snapshot while channelId is undefined", () => {
    const fake = makeFakePortal();
    const { result } = renderHook(() => useChannel({ channelId: undefined }), {
      wrapper: wrapperFor(fake),
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.messages).toEqual([]);
    expect(result.current.channel).toBeUndefined();
    expect(result.current.me).toBeUndefined();
  });
});

describe("callbacks", () => {
  it("maps onMention to the mention event", () => {
    const fake = makeFakePortal();
    const onMention = vi.fn();
    renderHook(() => useChannel({ channelId: "room", onMention }), {
      wrapper: wrapperFor(fake),
    });
    const msg = fakeMessage();
    act(() => fake.channel("room")?.emit("mention", msg));
    expect(onMention).toHaveBeenCalledWith(msg);
  });

  it("maps onError to the status event's error argument only when present", () => {
    const fake = makeFakePortal();
    const onError = vi.fn();
    renderHook(() => useChannel({ channelId: "room", onError }), {
      wrapper: wrapperFor(fake),
    });
    const ch = fake.channel("room");
    act(() => ch?.emit("status", "ready"));
    expect(onError).not.toHaveBeenCalled();

    const err = new PortalError("boom", "boom");
    act(() => ch?.emit("status", "ready", err));
    expect(onError).toHaveBeenCalledWith(err);
  });

  it("does not re-subscribe when inline callbacks change, and calls the latest", () => {
    const fake = makeFakePortal();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useChannel({ channelId: "room", onMention: cb }),
      { wrapper: wrapperFor(fake), initialProps: { cb: () => {} } },
    );
    const ch = fake.channel("room");
    // One effect subscribes to mention + status → exactly two on() calls, and they must not
    // grow as the caller passes a fresh inline function on every render.
    const onCallsAfterMount = (ch?.handle.on as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(onCallsAfterMount).toBe(2);

    const latest = vi.fn();
    rerender({ cb: latest });
    rerender({ cb: () => {} });
    rerender({ cb: latest });
    expect((ch?.handle.on as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);

    act(() => ch?.emit("mention", fakeMessage()));
    expect(latest).toHaveBeenCalledTimes(1);
  });
});

describe("readOn", () => {
  it("advances on mount by default", () => {
    const fake = makeFakePortal();
    renderHook(() => useChannel({ channelId: "room" }), { wrapper: wrapperFor(fake) });
    expect(fake.channel("room")?.handle.markAsRead).toHaveBeenCalledTimes(1);
  });

  it("never auto-advances under 'manual'", () => {
    const fake = makeFakePortal();
    renderHook(() => useChannel({ channelId: "room", readOn: "manual" }), {
      wrapper: wrapperFor(fake),
    });
    expect(fake.channel("room")?.handle.markAsRead).not.toHaveBeenCalled();
  });

  it("under 'visible', advances on a visible mount and on each visibilitychange→visible", () => {
    const fake = makeFakePortal();
    renderHook(() => useChannel({ channelId: "room", readOn: "visible" }), {
      wrapper: wrapperFor(fake),
    });
    const ch = fake.channel("room");
    // jsdom documents start visible.
    expect(ch?.handle.markAsRead).toHaveBeenCalledTimes(1);

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(ch?.handle.markAsRead).toHaveBeenCalledTimes(2);
  });

  it("under 'visible', does not advance while hidden, then advances when it becomes visible", () => {
    const fake = makeFakePortal();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");

    renderHook(() => useChannel({ channelId: "room", readOn: "visible" }), {
      wrapper: wrapperFor(fake),
    });
    const ch = fake.channel("room");
    expect(ch?.handle.markAsRead).not.toHaveBeenCalled();

    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(ch?.handle.markAsRead).toHaveBeenCalledTimes(1);
  });
});

describe("reserved surfaces", () => {
  it("throws NotYetSupportedError when a channel `where` is passed", () => {
    const fake = makeFakePortal();
    expect(() =>
      renderHook(() => useChannel({ channelId: "room", where: { type: { eq: "x" } } }), {
        wrapper: wrapperFor(fake),
      }),
    ).toThrow(NotYetSupportedError);
  });
});

describe("provider", () => {
  it("throws a clear error when a hook is used without a provider", () => {
    // No wrapper: usePortal finds no client.
    expect(() => renderHook(() => useChannel({ channelId: "room" }))).toThrow(
      /PortalProvider/,
    );
  });

  it("keeps a stable StrictMode wrapper without effect churn", () => {
    const fake = makeFakePortal();
    renderHook(() => useChannel({ channelId: "room" }), {
      wrapper: function Wrapper({ children }: { children: ReactNode }) {
        return <StrictMode>{wrapperFor(fake)({ children })}</StrictMode>;
      },
    });
    // Provider is passive; the only lifecycle calls come from the refcount effect.
    const ch = fake.channel("room");
    expect(ch?.handle.acquire).toHaveBeenCalled();
  });
});
