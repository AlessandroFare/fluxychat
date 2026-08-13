import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveApnsConfig, getApnsTokensForUser } from "./apns.js";

const TEST_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgTestKeyForUnitTestsOnly
-----END PRIVATE KEY-----`;

function makeEnv(overrides = {}) {
  const devices = [];
  const pushConfig = [];
  return {
    env: {
      APNS_KEY_ID: "KEY123",
      APNS_TEAM_ID: "TEAM456",
      APNS_BUNDLE_ID: "com.example.app",
      APNS_PRIVATE_KEY: TEST_KEY,
      APNS_USE_SANDBOX: "true",
      ...overrides,
      DB: {
        prepare(sql) {
          let params = [];
          return {
            bind(...p) {
              params = p;
              return this;
            },
            async first() {
              if (sql.includes("project_push_config")) {
                return pushConfig.find(
                  (r) => r.project_id === params[0] && r.environment === params[1],
                ) || null;
              }
              return null;
            },
            async all() {
              if (sql.includes("user_push_devices")) {
                return {
                  results: devices.filter(
                    (d) =>
                      d.project_id === params[0] &&
                      d.user_id === params[1] &&
                      (d.platform === "apns" || d.platform === "ios"),
                  ),
                };
              }
              return { results: [] };
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      },
    },
    devices,
    pushConfig,
  };
}

describe("apns", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveApnsConfig falls back to env vars", async () => {
    const { env } = makeEnv();
    const config = await resolveApnsConfig(env, "proj-1");
    expect(config).toMatchObject({
      keyId: "KEY123",
      teamId: "TEAM456",
      bundleId: "com.example.app",
      useSandbox: true,
    });
  });

  it("resolveApnsConfig prefers project_push_config row", async () => {
    const ctx = makeEnv({ APNS_KEY_ID: "", APNS_TEAM_ID: "", APNS_PRIVATE_KEY: "", APNS_BUNDLE_ID: "" });
    ctx.pushConfig.push({
      project_id: "proj-1",
      environment: "production",
      apns_key_id: "DBKEY",
      apns_team_id: "DBTEAM",
      apns_bundle_id: "com.db.app",
      apns_private_key_pem: TEST_KEY,
      apns_use_sandbox: 0,
    });
    const config = await resolveApnsConfig(ctx.env, "proj-1");
    expect(config?.keyId).toBe("DBKEY");
    expect(config?.useSandbox).toBe(false);
  });

  it("getApnsTokensForUser returns ios/apns tokens", async () => {
    const ctx = makeEnv();
    ctx.devices.push(
      { project_id: "p1", user_id: "u1", platform: "ios", token: "abc123" },
      { project_id: "p1", user_id: "u1", platform: "fcm", token: "ignored" },
    );
    const tokens = await getApnsTokensForUser(ctx.env, "p1", "u1");
    expect(tokens).toEqual(["abc123"]);
  });
});
