import { describe, expect, it } from "vitest";
import {
  assertSecretApiKey,
  isPublishableApiKey,
  isSecretApiKey,
} from "./api-key-kind.js";

describe("api-key-kind", () => {
  it("classifies prefixes", () => {
    expect(isPublishableApiKey("pk_abc")).toBe(true);
    expect(isSecretApiKey("fc_abc")).toBe(true);
    expect(isPublishableApiKey("fc_abc")).toBe(false);
  });

  it("blocks publishable keys on secret-only paths", () => {
    expect(assertSecretApiKey("pk_live").ok).toBe(false);
    expect(assertSecretApiKey("pk_live").error).toBe("publishable_key_not_allowed");
    expect(assertSecretApiKey("fc_live").ok).toBe(true);
  });
});
