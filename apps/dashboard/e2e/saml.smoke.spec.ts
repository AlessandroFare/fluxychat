import { test, expect } from "@playwright/test";

const workerUrl = (process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ?? "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);

/**
 * SAML route smoke against Worker (no dashboard session).
 * Skips when Worker is not reachable (CI dashboard-only smoke).
 */
test.describe("saml worker smoke", () => {
  test("GET /saml/config returns 401 without auth", async ({ request }) => {
    let res;
    try {
      res = await request.get(`${workerUrl}/saml/config`, { timeout: 5_000 });
    } catch {
      test.skip(true, "Worker not reachable — run integrated E2E with wrangler dev");
      return;
    }
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });
});
