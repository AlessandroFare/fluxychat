import { describe, expect, it, vi } from "vitest";
import { dispatchScheduledAdminRoutes } from "./scheduled-admin-http.js";
import { SCHEDULED_CRON_DIGEST } from "../lib/scheduled-runners.js";

vi.mock("../lib/scheduled-runners.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runScheduledCronJob: vi.fn(async () => ({ job: "daily_digest" })),
  };
});

describe("scheduled-admin-http", () => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*" };

  function makeDeps(overrides = {}) {
    return {
      env: {},
      json: (body, init = {}) =>
        new Response(JSON.stringify(body), {
          status: init.status ?? 200,
          headers: { "Content-Type": "application/json", ...corsHeaders, ...init.headers },
        }),
      corsHeaders,
      requestLogCtx: {},
      verifyJwtAndGetContext: async () =>
        overrides.auth === null
          ? null
          : {
              userId: "admin-1",
              projectId: "proj-1",
              roles: overrides.roles ?? ["admin"],
            },
      logError: () => {},
      hasAnyRole: (roles, allowed) => roles.some((r) => allowed.includes(r)),
      writeAuditEvent: vi.fn(async () => {}),
    };
  }

  it("POST /admin/scheduled/run requires admin", async () => {
    const res = await dispatchScheduledAdminRoutes(
      new Request("http://x/admin/scheduled/run", {
        method: "POST",
        headers: { Authorization: "Bearer t" },
        body: JSON.stringify({ cron: SCHEDULED_CRON_DIGEST }),
      }),
      new URL("http://x/admin/scheduled/run"),
      makeDeps({ roles: ["member"] }),
    );
    expect(res?.status).toBe(403);
  });

  it("POST /admin/scheduled/run rejects unknown cron", async () => {
    const res = await dispatchScheduledAdminRoutes(
      new Request("http://x/admin/scheduled/run", {
        method: "POST",
        headers: { Authorization: "Bearer t" },
        body: JSON.stringify({ cron: "every minute" }),
      }),
      new URL("http://x/admin/scheduled/run"),
      makeDeps(),
    );
    expect(res?.status).toBe(400);
  });

  it("POST /admin/scheduled/run triggers job", async () => {
    const { runScheduledCronJob } = await import("../lib/scheduled-runners.js");
    const res = await dispatchScheduledAdminRoutes(
      new Request("http://x/admin/scheduled/run", {
        method: "POST",
        headers: { Authorization: "Bearer t" },
        body: JSON.stringify({ cron: SCHEDULED_CRON_DIGEST }),
      }),
      new URL("http://x/admin/scheduled/run"),
      makeDeps(),
    );
    expect(res?.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.job).toBe("daily_digest");
    expect(runScheduledCronJob).toHaveBeenCalledWith({}, SCHEDULED_CRON_DIGEST);
  });
});
