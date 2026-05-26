import { describe, expect, it } from "vitest";
import { dispatchPublicRoutes } from "./public-http.js";

function buildDemoHandlerDeps(overrides = {}) {
  return {
    env: {
      DEMO_ENABLED: "true",
      DEMO_ROOM_ID: "public-demo",
      DEMO_API_KEY: "fc_demo_key",
      DEMO_USER_ID: "demo-guest",
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM rooms")) return { id: "public-demo" };
                  if (sql.includes("jwt_secret")) return { jwt_secret: "demo-jwt-secret-for-tests-32b" };
                  return null;
                },
                async run() {
                  return {};
                },
              };
            },
          };
        },
      },
      ...overrides.env,
    },
    ctx: { waitUntil() {} },
    traceId: "trace-test",
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => null,
    hasAnyRole: () => false,
    logError: () => {},
    writeAuditEvent: async () => {},
    sanitizeString: (value) => value,
    validateFileUpload: () => ({ valid: true }),
    getFileExtension: () => "",
    resolveProjectId: async () => "proj-demo",
    insertNewProject: async () => ({}),
    isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
    validateRoles: () => ({ valid: true, roles: ["member"] }),
    signJwtHs256: async () => "demo.jwt.token",
    maxRoomNameLength: 128,
    projectId: "default",
    checkAndConsumeRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    ...overrides,
  };
}

describe("GET /demo/session", () => {
  it("returns a guest session when demo env and rate limit deps are wired", async () => {
    const request = new Request("https://api.example.com/demo/session");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, buildDemoHandlerDeps());
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.enabled).toBe(true);
    expect(body.roomId).toBe("public-demo");
    expect(body.userId).toBe("demo-guest");
    expect(body.token).toBe("demo.jwt.token");
  });
});
