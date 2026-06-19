import { describe, expect, it, vi, beforeEach } from "vitest";
import { legacyHashApiKey } from "./api-key-hash.js";
import { resolveProjectId } from "./resolve-project-id.js";

describe("resolveProjectId (P0-4 hosted multi-tenant)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null in hosted mode when API key is missing", async () => {
    const env = { HOSTED_MULTI_TENANT: "true", DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
    const req = new Request("https://worker.example/rooms");
    await expect(resolveProjectId(req, env)).resolves.toBeNull();
  });

  it("falls back to default in self-host mode when API key is missing and ALLOW_LEGACY_DEFAULT_PROJECT=true (audit S-14)", async () => {
    const env = {
      DEFAULT_PROJECT_ID: "proj_local",
      ALLOW_LEGACY_DEFAULT_PROJECT: "true",
      DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) },
    };
    const req = new Request("https://worker.example/rooms");
    await expect(resolveProjectId(req, env)).resolves.toBe("proj_local");
  });

  it("returns null in self-host mode when ALLOW_LEGACY_DEFAULT_PROJECT is not set", async () => {
    const env = { DEFAULT_PROJECT_ID: "proj_local", DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
    const req = new Request("https://worker.example/rooms");
    await expect(resolveProjectId(req, env)).resolves.toBeNull();
  });

  it("returns null in hosted mode when API key hash is unknown", async () => {
    const env = {
      HOSTED_MULTI_TENANT: "true",
      DB: {
        prepare() {
          return {
            bind() {
              return { first: async () => null };
            },
          };
        },
      },
    };
    const req = new Request("https://worker.example/rooms", {
      headers: { "X-Fluxy-Api-Key": "fluxy_test_unknown" },
    });
    await expect(resolveProjectId(req, env)).resolves.toBeNull();
  });

  it("resolves legacy SHA-256 key_hash rows (audit S-11 migration)", async () => {
    const apiKey = "fc_legacy_test_key_abc123";
    const legacyHash = await legacyHashApiKey(apiKey);
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...params) {
              return {
                first: async () => {
                  if (
                    sql.includes("key_hmac") &&
                    params.includes(legacyHash)
                  ) {
                    return { project_id: "dev-local" };
                  }
                  return null;
                },
              };
            },
          };
        },
      },
    };
    const req = new Request("https://worker.example/auth/token", {
      headers: { "X-Fluxy-Api-Key": apiKey },
    });
    await expect(resolveProjectId(req, env)).resolves.toBe("dev-local");
  });
});
