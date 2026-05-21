import { describe, expect, it } from "vitest";
import {
  credentialStatusSummary,
  listProviderOptions,
} from "./llm-registry-ui";

describe("llm-registry-ui", () => {
  it("credentialStatusSummary prefers project key", () => {
    expect(
      credentialStatusSummary({ project: "configured", worker: "missing" }).ready,
    ).toBe(true);
    expect(
      credentialStatusSummary({ project: "missing", worker: "configured" }).label,
    ).toContain("Worker");
  });

  it("listProviderOptions falls back to static registry", () => {
    const opts = listProviderOptions(null);
    expect(opts.some((p) => p.id === "openai")).toBe(true);
  });
});
