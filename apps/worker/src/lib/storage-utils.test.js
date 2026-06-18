import { describe, expect, it } from "vitest";
import { truncateForStorageBytes, truncateForStorage } from "./storage-utils.js";

describe("truncateForStorage (existing, surrogate-safe)", () => {
  it("returns null for null or empty input", () => {
    expect(truncateForStorage(null)).toBeNull();
    expect(truncateForStorage("")).toBeNull();
    expect(truncateForStorage(undefined)).toBeNull();
  });

  it("returns the input unchanged when it fits", () => {
    expect(truncateForStorage("hello", 10)).toBe("hello");
  });

  it("truncates long ASCII text and appends ellipsis", () => {
    const result = truncateForStorage("abcdefghijklmnop", 10);
    expect(result).toBe("abcdefghij...");
  });
});

describe("truncateForStorageBytes (B-4, byte-safe at 4000 bytes)", () => {
  it("returns null for null or empty input", () => {
    expect(truncateForStorageBytes(null)).toBeNull();
    expect(truncateForStorageBytes("")).toBeNull();
  });

  it("returns the input unchanged when it fits", () => {
    expect(truncateForStorageBytes("hello", 100)).toBe("hello");
  });

  it("truncates a 4-byte emoji string without splitting a codepoint", () => {
    // Each emoji is 4 UTF-8 bytes. A 100-emoji string = 400 bytes.
    const emoji = "🚀";
    const s = emoji.repeat(1000); // 4000 bytes
    const out = truncateForStorageBytes(s, 4000);
    // 4000-byte cut must not split an emoji. We re-decode the
    // output and assert round-trip equality.
    expect(out).toBeTruthy();
    // The decoded output must be valid UTF-8 (TextDecoder with fatal
    // would throw on a partial sequence).
    const bytes = new TextEncoder().encode(out);
    const back = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Each character should be an intact 🚀.
    expect(back.length).toBeGreaterThan(0);
    expect([...back].every((c) => c === "🚀")).toBe(true);
    // Original was exactly 4000 bytes; the result is ≤ 4000 bytes
    // (and includes the 3-byte "..." suffix when truncation happens).
    expect(bytes.length).toBeLessThanOrEqual(4003); // 4000 + "..."
  });

  it("truncates pure ASCII to the byte limit", () => {
    const s = "a".repeat(5000);
    const out = truncateForStorageBytes(s, 4000);
    // The cut is at 4000 bytes; we get the first 4000 'a' chars + "...".
    // "..." is 3 bytes, so total ≤ 4003.
    const bytes = new TextEncoder().encode(out);
    expect(bytes.length).toBeLessThanOrEqual(4003);
    expect(out.startsWith("a".repeat(4000))).toBe(true);
  });

  it("round-trips mixed UTF-8 text through encode/decode without error", () => {
    const s = "héllo 🚀 world 🌍  漢字  " + "a".repeat(4000);
    const out = truncateForStorageBytes(s, 1000);
    // The output must be valid UTF-8.
    const bytes = new TextEncoder().encode(out);
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes)).not.toThrow();
  });
});
