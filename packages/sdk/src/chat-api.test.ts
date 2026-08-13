import { describe, expect, it } from "vitest";
import {
  buildThreadId,
  inferAdapterFromUserId,
  parseAdapterSlug,
} from "./chat-api";

describe("inferAdapterFromUserId", () => {
  it("detects Slack user IDs", () => {
    expect(inferAdapterFromUserId("U123ABC")).toBe("slack");
    expect(inferAdapterFromUserId("W123ABC")).toBe("slack");
  });

  it("detects Discord snowflakes", () => {
    expect(inferAdapterFromUserId("123456789012345678")).toBe("discord");
  });

  it("detects Teams and Google Chat prefixes", () => {
    expect(inferAdapterFromUserId("29:abc")).toBe("teams");
    expect(inferAdapterFromUserId("users/123")).toBe("gchat");
  });

  it("detects Fluxy web UUIDs", () => {
    expect(inferAdapterFromUserId("550e8400-e29b-41d4-a716-446655440000")).toBe("web");
  });

  it("returns null for unknown formats", () => {
    expect(inferAdapterFromUserId("not-a-valid-id")).toBeNull();
  });
});

describe("parseAdapterSlug", () => {
  it("extracts adapter from thread id", () => {
    expect(parseAdapterSlug("slack:C123:1234.5678")).toBe("slack");
  });
});

describe("buildThreadId", () => {
  it("builds thread ids with and without message id", () => {
    expect(buildThreadId("slack", "C123")).toBe("slack:C123:");
    expect(buildThreadId("slack", "C123", "1234.5678")).toBe("slack:C123:1234.5678");
  });
});
