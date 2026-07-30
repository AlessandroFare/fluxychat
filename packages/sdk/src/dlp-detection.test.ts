import { describe, it, expect } from "vitest";
import { createDlpDetector } from "./dlp-detection";

describe("dlp-detection", () => {
  it("should have default policy", () => {
    const d = createDlpDetector();
    expect(d.listPolicies()).toHaveLength(1);
  });

  it("should detect SSN in text", () => {
    const d = createDlpDetector();
    const result = d.scanText("content-1", "My SSN is 987-65-4321");
    expect(result.safe).toBe(false);
    expect(result.matches.some((m) => m.entityType === "phi")).toBe(true);
  });

  it("should detect credit card in text", () => {
    const d = createDlpDetector();
    const result = d.scanText("content-2", "Card: 4111 1111 1111 1111");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].entityType).toBe("pci");
  });

  it("should redact sensitive content on block action", () => {
    const d = createDlpDetector();
    const result = d.scanText("content-3", "SSN: 123-45-6789 and email: test@example.com");
    expect(result.redacted).toBeTruthy();
    expect(result.redacted).not.toContain("123-45-6789");
  });

  it("should scan file as safe", () => {
    const d = createDlpDetector();
    const result = d.scanFile("file-1", "file");
    expect(result.safe).toBe(true);
  });

  it("should create custom policy", () => {
    const d = createDlpDetector();
    d.createPolicy({ policyId: "custom-1", name: "Custom", version: 1, patterns: [{ patternId: "api-key", entityType: "credential", label: "API Key", regex: "sk-[a-zA-Z0-9]+", severity: "critical", action: "block" }], contentKinds: ["text"], enabled: true });
    expect(d.listPolicies()).toHaveLength(2);
  });

  it("should scan with custom policy", () => {
    const d = createDlpDetector();
    d.createPolicy({ policyId: "custom-2", name: "Custom2", version: 1, patterns: [{ patternId: "api-key", entityType: "credential", label: "API Key", regex: "sk-[a-zA-Z0-9]+", severity: "critical", action: "block" }], contentKinds: ["text"], enabled: true });
    const result = d.scanText("c-4", "sk-test-key-12345", "custom-2");
    expect(result.matches).toHaveLength(1);
  });
});
