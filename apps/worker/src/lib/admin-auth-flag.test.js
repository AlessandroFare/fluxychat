import { describe, expect, it } from "vitest";
import { isAdminAuthRequired } from "./admin-auth-flag.js";

describe("isAdminAuthRequired", () => {
  it("defaults to required", () => {
    expect(isAdminAuthRequired({})).toBe(true);
    expect(isAdminAuthRequired({ REQUIRE_ADMIN_AUTH: "true" })).toBe(true);
  });

  it("ignores false in production", () => {
    expect(
      isAdminAuthRequired({ REQUIRE_ADMIN_AUTH: "false", NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("allows false only in development or test", () => {
    expect(
      isAdminAuthRequired({ REQUIRE_ADMIN_AUTH: "false", NODE_ENV: "development" }),
    ).toBe(false);
    expect(
      isAdminAuthRequired({ REQUIRE_ADMIN_AUTH: "false", NODE_ENV: "test" }),
    ).toBe(false);
  });
});
