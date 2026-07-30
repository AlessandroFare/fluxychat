import { describe, expect, it, afterEach, vi } from "vitest";
import {
  getNativeSocketFactory,
  getPartySocketFactory,
  resetSocketFactories,
  resolveSocketFactory,
  setNativeSocketFactory,
  setPartySocketFactory,
} from "./factory.js";

describe("transport factory", () => {
  afterEach(() => {
    resetSocketFactories();
  });

  it("defaults to native WebSocket for non-party connections", () => {
    const native = getNativeSocketFactory();
    const party = getPartySocketFactory();
    expect(resolveSocketFactory(false)).toBe(native);
    expect(resolveSocketFactory(true)).toBe(party);
    expect(native).not.toBe(party);
  });

  it("allows test seams via setNative/setParty + reset", () => {
    const stub = vi.fn(() => ({}) as WebSocket);
    setNativeSocketFactory(stub);
    expect(resolveSocketFactory(false)).toBe(stub);
    resetSocketFactories();
    expect(resolveSocketFactory(false)).not.toBe(stub);
  });

  it("swaps party factory independently", () => {
    const stub = vi.fn(() => ({}) as WebSocket);
    setPartySocketFactory(stub);
    expect(resolveSocketFactory(true)).toBe(stub);
    expect(resolveSocketFactory(false)).toBe(getNativeSocketFactory());
  });
});
