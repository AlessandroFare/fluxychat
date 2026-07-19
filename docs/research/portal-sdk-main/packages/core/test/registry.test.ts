import { afterEach, describe, expect, it, vi } from "vitest";

import { Portal } from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("channel registry", () => {
  it("returns the same handle for the same id while it is referenced", () => {
    const portal = new Portal({ apiKey: "pk", token: "jwt" });
    expect(portal.channel("room")).toBe(portal.channel("room"));
  });

  it("returns distinct handles for distinct ids", () => {
    const portal = new Portal({ apiKey: "pk", token: "jwt" });
    expect(portal.channel("a")).not.toBe(portal.channel("b"));
  });

  it("keeps first-creation options and warns when a later call differs (dev)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const portal = new Portal({ apiKey: "pk", token: "jwt" });

    const first = portal.channel("room", { history: 50 });
    const second = portal.channel("room", { history: 10 });

    expect(second).toBe(first);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not warn when a later call repeats the same options", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const portal = new Portal({ apiKey: "pk", token: "jwt" });

    portal.channel("room", { history: 50 });
    portal.channel("room", { history: 50 });

    expect(warn).not.toHaveBeenCalled();
  });
});
