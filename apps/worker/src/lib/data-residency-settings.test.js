import { describe, it, expect } from "vitest";
import {
  assertProjectWriteResidency,
  normalizeRegionCode,
  resolveWorkerRegion,
  upsertProjectResidencySettings,
} from "./data-residency-settings.js";

function createEnv({ region = "eu-west", row = null } = {}) {
  const store = row ? { ...row } : {};
  return {
    DATA_REGION: region,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM project_data_residency")) {
                  if (!store.primary_region && !store.project_id) return null;
                  return {
                    primary_region: store.primary_region,
                    allowed_regions_json: store.allowed_regions_json,
                    inference_region: store.inference_region,
                    enforce_writes: store.enforce_writes,
                    updated_at: store.updated_at,
                  };
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT INTO project_data_residency")) {
                  store.project_id = args[0];
                  store.primary_region = args[1];
                  store.allowed_regions_json = args[2];
                  store.inference_region = args[3];
                  store.enforce_writes = args[4];
                  store.updated_at = args[5];
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("data-residency-settings", () => {
  it("normalizes Cloudflare colo aliases", () => {
    expect(normalizeRegionCode("WEUR")).toBe("eu-west");
    expect(normalizeRegionCode("eu-central")).toBe("eu-central");
  });

  it("resolves worker region from env", () => {
    expect(resolveWorkerRegion({ DATA_REGION: "us-east" })).toBe("us-east");
  });

  it("blocks writes outside allowed regions when configured", async () => {
    const env = createEnv({
      region: "us-east",
      row: {
        primary_region: "eu-west",
        allowed_regions_json: '["eu-west"]',
        inference_region: "eu-west",
        enforce_writes: 1,
        updated_at: "2026-01-01",
      },
    });
    const check = await assertProjectWriteResidency(env, "p1", { operation: "message_create" });
    expect(check.ok).toBe(false);
    expect(check.error).toBe("data_residency_violation");
  });

  it("upserts residency policy", async () => {
    const env = createEnv();
    const result = await upsertProjectResidencySettings(env, "p1", {
      primaryRegion: "eu-west",
      allowedRegions: ["eu-west", "eu-central"],
      inferenceRegion: "eu-west",
      enforceWrites: true,
    });
    expect(result.ok).toBe(true);
    expect(result.settings.primaryRegion).toBe("eu-west");
  });
});
