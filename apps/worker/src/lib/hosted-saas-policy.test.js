import { describe, expect, it } from "vitest";
import {
  hostedTenantPlanMutationForbidden,
  isHostedSamlLoginEnabled,
  isPlatformOperatorProject,
  workerSharedLlmAllowed,
} from "./hosted-saas-policy.js";

describe("hosted-saas-policy", () => {
  const platformId = "platform-uuid";
  const tenantId = "tenant-uuid";
  const hostedEnv = {
    HOSTED_MULTI_TENANT: "true",
    FLUXY_PLATFORM_PROJECT_ID: platformId,
  };

  it("denies plan mutation for hosted tenants", () => {
    const deny = hostedTenantPlanMutationForbidden(
      { projectId: tenantId, userId: "u1", roles: ["admin"] },
      hostedEnv,
    );
    expect(deny?.reason).toBe("platform_operator_required");
  });

  it("allows plan mutation for platform operator JWT", () => {
    expect(
      hostedTenantPlanMutationForbidden(
        { projectId: platformId, userId: "op", roles: ["admin"] },
        hostedEnv,
      ),
    ).toBeNull();
  });

  it("blocks worker LLM fallback for hosted tenants", () => {
    expect(workerSharedLlmAllowed(hostedEnv, tenantId)).toBe(false);
    expect(workerSharedLlmAllowed(hostedEnv, platformId)).toBe(true);
    expect(
      workerSharedLlmAllowed({ ...hostedEnv, ALLOW_WORKER_LLM_FALLBACK: "true" }, tenantId),
    ).toBe(true);
  });

  it("keeps SAML login on for self-host and off for hosted unless flagged", () => {
    expect(isHostedSamlLoginEnabled({})).toBe(true);
    expect(isHostedSamlLoginEnabled(hostedEnv)).toBe(false);
    expect(isHostedSamlLoginEnabled({ ...hostedEnv, SAML_SSO_ENABLED: "true" })).toBe(true);
  });

  it("treats self-hosted as platform operator for all projects", () => {
    const env = {};
    expect(isPlatformOperatorProject("any", env)).toBe(true);
    expect(workerSharedLlmAllowed(env, "any")).toBe(true);
  });
});
