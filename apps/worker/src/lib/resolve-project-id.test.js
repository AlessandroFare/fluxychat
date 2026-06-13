import { describe, expect, it, vi, beforeEach } from "vitest";
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

  it("falls back to default in self-host mode when API key is missing", async () => {
    const env = { DEFAULT_PROJECT_ID: "proj_local", DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
    const req = new Request("https://worker.example/rooms");
    await expect(resolveProjectId(req, env)).resolves.toBe("proj_local");
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
});
