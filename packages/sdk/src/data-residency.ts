export type RegionCode = "us-east" | "us-west" | "eu-west" | "eu-central" | "ap-southeast" | "ap-northeast" | "sa-east" | "me-central";

export interface RegionConstraint {
  region: RegionCode;
  allowedSubprocessors: string[];
  backupRegion?: RegionCode;
  inferenceRouting: "same-region" | "nearest" | "explicit";
}

export interface ResidencyPolicy {
  policyId: string;
  tenantId: string;
  primaryRegion: RegionCode;
  backupRegion?: RegionCode;
  allowedRegions: RegionCode[];
  blockedRegions: RegionCode[];
  subprocessors: string[];
  inferenceAllowedRegions: RegionCode[];
  createdAt: string;
  updatedAt: string;
}

export interface DataLocation {
  primaryRegion: RegionCode;
  backupRegion?: RegionCode;
  inferenceRegion: RegionCode;
  storageRegions: RegionCode[];
  subprocessors: string[];
}

export interface ResidencyValidator {
  createPolicy(tenantId: string, primaryRegion: RegionCode): ResidencyPolicy;
  updatePolicy(tenantId: string, updates: Partial<ResidencyPolicy>): ResidencyPolicy;
  getPolicy(tenantId: string): ResidencyPolicy | null;
  validateDataLocation(tenantId: string, targetRegion: RegionCode): { allowed: boolean; reason?: string };
  resolveInferenceRegion(tenantId: string, preferredRegions: RegionCode[]): RegionCode;
  getDataLocation(tenantId: string): DataLocation | null;
  listPolicies(): ResidencyPolicy[];
}

const REGION_SUBPROCESSORS: Record<RegionCode, string[]> = {
  "us-east": ["aws-us-east-1", "gcp-us-east1"],
  "us-west": ["aws-us-west-2", "gcp-us-west1"],
  "eu-west": ["aws-eu-west-1", "gcp-europe-west1", "azure-west-europe"],
  "eu-central": ["aws-eu-central-1", "gcp-europe-central2"],
  "ap-southeast": ["aws-ap-southeast-1", "gcp-asia-southeast1"],
  "ap-northeast": ["aws-ap-northeast-1", "gcp-asia-northeast1"],
  "sa-east": ["aws-sa-east-1"],
  "me-central": ["aws-me-central-1"],
};

export function createResidencyValidator(): ResidencyValidator {
  const policies = new Map<string, ResidencyPolicy>();

  return {
    createPolicy(tenantId: string, primaryRegion: RegionCode): ResidencyPolicy {
      const policy: ResidencyPolicy = {
        policyId: `rp-${tenantId}`,
        tenantId,
        primaryRegion,
        allowedRegions: [primaryRegion],
        blockedRegions: [],
        subprocessors: REGION_SUBPROCESSORS[primaryRegion] ?? [],
        inferenceAllowedRegions: [primaryRegion],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      policies.set(tenantId, policy);
      return policy;
    },

    updatePolicy(tenantId: string, updates: Partial<ResidencyPolicy>): ResidencyPolicy {
      const existing = policies.get(tenantId);
      if (!existing) throw new Error(`No policy for tenant ${tenantId}.`);
      const updated: ResidencyPolicy = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      policies.set(tenantId, updated);
      return updated;
    },

    getPolicy(tenantId: string) { return policies.get(tenantId) ?? null; },

    validateDataLocation(tenantId: string, targetRegion: RegionCode): { allowed: boolean; reason?: string } {
      const policy = policies.get(tenantId);
      if (!policy) return { allowed: false, reason: "No residency policy" };
      if (policy.blockedRegions.includes(targetRegion)) return { allowed: false, reason: `Region ${targetRegion} is blocked` };
      if (policy.allowedRegions.length > 0 && !policy.allowedRegions.includes(targetRegion)) {
        return { allowed: false, reason: `Region ${targetRegion} not in allowed regions` };
      }
      return { allowed: true };
    },

    resolveInferenceRegion(tenantId: string, preferredRegions: RegionCode[]): RegionCode {
      const policy = policies.get(tenantId);
      if (!policy) return preferredRegions[0] ?? "us-east";
      for (const region of preferredRegions) {
        if (policy.inferenceAllowedRegions.includes(region)) return region;
      }
      return policy.primaryRegion;
    },

    getDataLocation(tenantId: string): DataLocation | null {
      const policy = policies.get(tenantId);
      if (!policy) return null;
      return {
        primaryRegion: policy.primaryRegion,
        backupRegion: policy.backupRegion,
        inferenceRegion: policy.primaryRegion,
        storageRegions: [...policy.allowedRegions],
        subprocessors: [...policy.subprocessors],
      };
    },

    listPolicies() { return [...policies.values()]; },
  };
}
