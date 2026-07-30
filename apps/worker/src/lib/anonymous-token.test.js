import { describe, expect, it, vi } from "vitest";
import { issueAnonymousToken } from "./anonymous-token.js";

describe("issueAnonymousToken", () => {
  it("returns 401 without api key", async () => {
    const result = await issueAnonymousToken(
      { DEFAULT_PROJECT_ID: "default", DB: { prepare: vi.fn() } },
      {
        signJwtHs256: vi.fn(),
        isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
        resolveProjectId: vi.fn(),
      },
      new Request("http://localhost/tokens/anonymous", { method: "POST" }),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it("mints token for valid api key", async () => {
    const signJwtHs256 = vi.fn(async () => "signed.jwt.token");
    const env = {
      DEFAULT_PROJECT_ID: "default",
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => ({ jwt_secret: "secret" })),
          })),
        })),
      },
    };
    const request = new Request("http://localhost/tokens/anonymous", {
      method: "POST",
      headers: { "X-Fluxy-Api-Key": "fc_test" },
    });
    const result = await issueAnonymousToken(
      env,
      {
        signJwtHs256,
        isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
        resolveProjectId: vi.fn(async () => "proj1"),
      },
      request,
    );
    expect(result.ok).toBe(true);
    expect(result.body.token).toBe("signed.jwt.token");
    expect(result.body.userId).toMatch(/^anon_/);
    expect(signJwtHs256).toHaveBeenCalled();
  });
});
