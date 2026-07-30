// @vitest-environment node
// Runs in node (no jsdom) so window/document are genuinely absent — the actual condition a
// Next.js server prerender exercises for a Client Component, despite "use client".
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PortalProvider } from "../src/index.js";
import type { UseChannelResult, UseInboxResult } from "../src/types.js";
import { useChannel } from "../src/use-channel.js";
import { useInbox } from "../src/use-inbox.js";
import { isServerEnvironment } from "../src/ssr.js";
import { makeFakePortal, type FakePortal } from "./fakes.js";

function renderProbe(fake: FakePortal, Probe: () => null): void {
  renderToStaticMarkup(
    createElement(PortalProvider, { client: fake.portal, children: createElement(Probe) }),
  );
}

describe("isServerEnvironment", () => {
  it("is true in this node environment", () => {
    expect(typeof window).toBe("undefined");
    expect(isServerEnvironment()).toBe(true);
  });
});

describe("useChannel is SSR-inert", () => {
  it("renders an idle snapshot without throwing, and never touches the registry", () => {
    const fake = makeFakePortal();
    let captured: UseChannelResult | undefined;
    function Probe() {
      captured = useChannel({ channelId: "room" });
      return null;
    }

    expect(() => renderProbe(fake, Probe)).not.toThrow();

    expect(captured?.status).toBe("idle");
    expect(captured?.messages).toEqual([]);
    expect(captured?.channel).toBeUndefined();
    expect(captured?.me).toBeUndefined();
    expect(captured?.presence).toBeUndefined();
    expect(captured?.hasPrevious).toBe(false);
    // portal.channel("room") was never consulted — no handle exists to acquire.
    expect(fake.channel("room")).toBeUndefined();
  });

  it("no-ops send/loadPrevious/sendActivity/markAsRead/setMetadata while inert", async () => {
    const fake = makeFakePortal();
    let captured: UseChannelResult | undefined;
    function Probe() {
      captured = useChannel({ channelId: "room" });
      return null;
    }
    renderProbe(fake, Probe);

    expect(captured).toBeDefined();
    await expect(captured?.send({ content: "hi" })).rejects.toThrow();
    await expect(captured?.loadPrevious()).resolves.toBe(false);
    expect(() => captured?.sendActivity("typing")).not.toThrow();
    expect(() => captured?.markAsRead()).not.toThrow();
    expect(() => captured?.setMetadata({ x: 1 })).not.toThrow();
    expect(fake.channel("room")).toBeUndefined();
  });

  it("still renders inert when channelId is defined and onMention/onMessage/onError are passed", () => {
    const fake = makeFakePortal();
    let captured: UseChannelResult | undefined;
    function Probe() {
      captured = useChannel({
        channelId: "room",
        onMention: vi.fn(),
        onMessage: vi.fn(),
        onError: vi.fn(),
      });
      return null;
    }

    expect(() => renderProbe(fake, Probe)).not.toThrow();
    expect(captured?.status).toBe("idle");
    // No effect ever ran server-side, so nothing was registered to fire these callbacks.
    expect(fake.channel("room")).toBeUndefined();
  });
});

describe("useInbox is SSR-inert", () => {
  it("renders an idle snapshot without throwing or connecting", () => {
    const fake = makeFakePortal();
    let captured: UseInboxResult | undefined;
    function Probe() {
      captured = useInbox();
      return null;
    }

    expect(() => renderProbe(fake, Probe)).not.toThrow();

    expect(captured?.status).toBe("idle");
    expect(captured?.channels).toHaveLength(0);
    expect(captured?.channels.get("c1")).toBeUndefined();
    expect(captured?.items).toEqual([]);
    expect(captured?.counter).toBe(0);
    expect(captured?.unseen).toBe(0);
    // portal.inbox() connects immediately on call in a real client — must never be reached.
    expect(vi.mocked(fake.portal.inbox)).not.toHaveBeenCalled();
  });

  it("no-ops markAllRead while inert, and never fires onItem", () => {
    const fake = makeFakePortal();
    const onItem = vi.fn();
    let captured: UseInboxResult | undefined;
    function Probe() {
      captured = useInbox({ onItem });
      return null;
    }

    renderProbe(fake, Probe);

    expect(() => captured?.markAllRead()).not.toThrow();
    expect(onItem).not.toHaveBeenCalled();
    expect(vi.mocked(fake.portal.inbox)).not.toHaveBeenCalled();
  });
});
