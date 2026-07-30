import { describe, it, expect } from "vitest";
import { createResidencyValidator } from "./data-residency";

describe("data-residency", () => {
  it("should create a policy", () => {
    const r = createResidencyValidator();
    const policy = r.createPolicy("tenant-1", "eu-west");
    expect(policy.primaryRegion).toBe("eu-west");
    expect(policy.subprocessors.length).toBeGreaterThan(0);
  });

  it("should validate allowed data location", () => {
    const r = createResidencyValidator();
    r.createPolicy("tenant-1", "us-east");
    const result = r.validateDataLocation("tenant-1", "us-east");
    expect(result.allowed).toBe(true);
  });

  it("should reject blocked data location", () => {
    const r = createResidencyValidator();
    r.createPolicy("tenant-1", "us-east");
    r.updatePolicy("tenant-1", { blockedRegions: ["eu-west"] });
    const result = r.validateDataLocation("tenant-1", "eu-west");
    expect(result.allowed).toBe(false);
  });

  it("should resolve inference region from preferred list", () => {
    const r = createResidencyValidator();
    r.createPolicy("tenant-1", "eu-west");
    r.updatePolicy("tenant-1", { inferenceAllowedRegions: ["eu-west", "us-east"] });
    const region = r.resolveInferenceRegion("tenant-1", ["us-east"]);
    expect(region).toBe("us-east");
  });

  it("should return data location", () => {
    const r = createResidencyValidator();
    r.createPolicy("tenant-1", "eu-central");
    const loc = r.getDataLocation("tenant-1");
    expect(loc?.primaryRegion).toBe("eu-central");
    expect(loc?.storageRegions).toContain("eu-central");
  });

  it("should list policies", () => {
    const r = createResidencyValidator();
    r.createPolicy("t1", "us-east");
    r.createPolicy("t2", "eu-west");
    expect(r.listPolicies()).toHaveLength(2);
  });
});
