import { describe, expect, it } from "vitest";
import { hasClerkPublishableKey, isClerkEnabled } from "./clerk-config";

describe("clerk-config e2e self-host", () => {
  it("treats NEXT_PUBLIC_FLUXY_E2E_SELF_HOST as Clerk off", () => {
    const prevPublic = process.env.NEXT_PUBLIC_FLUXY_E2E_SELF_HOST;
    const prevKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const prevSecret = process.env.CLERK_SECRET_KEY;
    process.env.NEXT_PUBLIC_FLUXY_E2E_SELF_HOST = "1";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fake";
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    try {
      expect(hasClerkPublishableKey()).toBe(false);
      expect(isClerkEnabled()).toBe(false);
    } finally {
      if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_FLUXY_E2E_SELF_HOST;
      else process.env.NEXT_PUBLIC_FLUXY_E2E_SELF_HOST = prevPublic;
      if (prevKey === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = prevKey;
      if (prevSecret === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = prevSecret;
    }
  });
});
