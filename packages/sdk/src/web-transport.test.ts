import { describe, it, expect } from "vitest";
import { createWebTransportAdapter } from "./web-transport";

describe("createWebTransportAdapter", () => {
  it("isSupported returns false in Node", () => {
    const wt = createWebTransportAdapter();
    expect(wt.isSupported()).toBe(false);
  });

  it("negotiate returns unsupported in Node", () => {
    const wt = createWebTransportAdapter();
    const n = wt.negotiate();
    expect(n.supported).toBe(false);
    expect(n.fallback).toBe("websocket");
  });

  it("starts disconnected", () => {
    const wt = createWebTransportAdapter();
    expect(wt.getState()).toBe("disconnected");
  });

  it("connect returns false in Node", async () => {
    const wt = createWebTransportAdapter();
    expect(await wt.connect("https://example.com")).toBe(false);
  });

  it("disconnect sets state", () => {
    const wt = createWebTransportAdapter();
    wt.disconnect();
    expect(wt.getState()).toBe("disconnected");
  });

  it("send throws when not connected", () => {
    const wt = createWebTransportAdapter();
    expect(() => wt.send("data")).toThrow("Not connected");
  });
});
