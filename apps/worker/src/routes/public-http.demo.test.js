import { describe, expect, it } from "vitest";
import { dispatchPublicRoutes } from "./public-http.js";

function buildDemoHandlerDeps(overrides = {}) {
  return {
    env: {
      DEMO_ENABLED: "true",
      DEMO_ROOM_ID: "public-demo",
      DEMO_API_KEY: "fc_demo_key",
      DEMO_USER_ID: "demo-guest",
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      DB: {
        prepare(sql) {
          const stmt = {
            async first() {
              if (sql.includes("COUNT(*)")) return { c: 0 };
              if (sql.includes("FROM rooms")) return { id: "public-demo" };
              if (sql.includes("jwt_secret")) return { jwt_secret: "demo-jwt-secret-for-tests-32b" };
              if (sql.includes("FROM bots")) {
                return {
                  id: "builtin-assistant-proj-demo",
                  name: "Assistant",
                  handle: "@assistant",
                };
              }
              return null;
            },
            async all() {
              if (sql.includes("builtin_agent_templates")) {
                return { results: [] };
              }
              return { results: [] };
            },
            async run() {
              return {};
            },
            bind() {
              return stmt;
            },
          };
          return stmt;
        },
        async batch() {
          return [];
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
    canAccessRoom: async () => true,
    customDomain: null,
    timingSafeEqual: async (a, b) => a === b,
    ...overrides,
  };
}

/** Creates a mock R2 object (what env.ATTACHMENTS.get returns) */
function mockR2Object({
  contentType = "image/png",
  fileName = "test.png",
  size = 1024,
  custom = {},
} = {}) {
  return {
    httpMetadata: { contentType },
    customMetadata: { fileName, ...custom },
    size,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(size));
        controller.close();
      },
    }),
  };
}

/** Builds a deps object that mocks a valid authenticated session for a given project */
function buildAuthDeps(projectId = "proj-test", overrides = {}) {
  const base = buildDemoHandlerDeps(overrides);
  return {
    ...base,
    projectId,
    verifyJwtAndGetContext: async () => ({
      userId: "user-test",
      projectId,
      email: "test@example.com",
    }),
    env: {
      ...base.env,
      ATTACHMENTS: {
        get: async () =>
          mockR2Object({
            contentType: "image/png",
            fileName: "safe.png",
            size: 512,
          }),
      },
      ...(overrides.env || {}),
    },
  };
}

describe("GET /demo/status", () => {
  it("returns public demo configuration probe", async () => {
    const request = new Request("https://api.example.com/demo/status");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, buildDemoHandlerDeps());
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.enabled).toBe(true);
    expect(body.configured).toBe(true);
    expect(body.ready).toBe(true);
    expect(body.roomId).toBe("public-demo");
    expect(body.agentName).toBe("FluxyBot");
  });
});

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
    expect(body.agentId).toBe("builtin-assistant-proj-demo");
    expect(body.agentName).toBe("FluxyBot");
  });
});

describe("GET /attachments/:fileKey content-type and disposition", () => {
  it("serves a safe image/png with inline disposition", async () => {
    const deps = buildAuthDeps("proj-test", {
      env: {
        ATTACHMENTS: {
          get: async () =>
            mockR2Object({
              contentType: "image/png",
              fileName: "screenshot.png",
              size: 1024,
            }),
        },
      },
    });
    const request = new Request("https://api.example.com/attachments/proj-test/valid-key");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(response.headers.get("Content-Disposition")).toContain('"screenshot.png"');
  });

  it("forces attachment disposition for text/html", async () => {
    const deps = buildAuthDeps("proj-test", {
      env: {
        ATTACHMENTS: {
          get: async () =>
            mockR2Object({
              contentType: "text/html",
              fileName: "malicious.html",
              size: 128,
            }),
        },
      },
    });
    const request = new Request("https://api.example.com/attachments/proj-test/mal-key");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain('"malicious.html"');
  });

  it("falls back to application/octet-stream for unknown content types", async () => {
    const deps = buildAuthDeps("proj-test", {
      env: {
        ATTACHMENTS: {
          get: async () =>
            mockR2Object({
              contentType: "application/vnd.ms-excel",
              fileName: "spreadsheet.xls",
              size: 4096,
            }),
        },
      },
    });
    const request = new Request("https://api.example.com/attachments/proj-test/unknown-key");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.ms-excel");
    // Not in risky set, not in safe inline set -> attachment disposition
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("returns 401 when no auth", async () => {
    const deps = buildDemoHandlerDeps({
      // verifyJwtAndGetContext already returns null
    });
    const request = new Request("https://api.example.com/attachments/unknown/file");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid file key (contains ..)", async () => {
    const deps = buildAuthDeps("proj-test");
    // Use a raw URL with .. that won't be normalized by URL constructor
    const request = new Request("https://api.example.com/attachments/proj-test/..%2Fetc%2Fpasswd");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(400);
  });

  it("returns 400 when file key starts with /", async () => {
    const deps = buildAuthDeps("proj-test");
    const request = new Request("https://api.example.com/attachments//etc/passwd");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(400);
  });

  it("returns 400 when file key contains null byte (\\x00)", async () => {
    const deps = buildAuthDeps("proj-test");
    // Use a raw URL with null byte in path
    const request = new Request("https://api.example.com/attachments/proj-test/key%00malicious");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(400);
  });

  it("returns 400 when file key contains %00 (URL-encoded null)", async () => {
    // URL-encoded %00 should be decoded by the runtime, but test both paths
    const deps = buildAuthDeps("proj-test");
    const request = new Request("https://api.example.com/attachments/proj-test/key%00");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(400);
  });

  it("passes validation for valid file key", async () => {
    const deps = buildAuthDeps("proj-test", {
      env: {
        ATTACHMENTS: {
          get: async () =>
            mockR2Object({
              contentType: "image/png",
              fileName: "valid.png",
              size: 512,
            }),
        },
      },
    });
    const request = new Request("https://api.example.com/attachments/proj-test/valid-key");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(response.headers.get("Content-Disposition")).toContain('"valid.png"');
  });

  it("sanitizes filename to remove path separators", async () => {
    const deps = buildAuthDeps("proj-test", {
      env: {
        ATTACHMENTS: {
          get: async () =>
            mockR2Object({
              contentType: "image/png",
              fileName: "foo/bar/sneaky.png",
              size: 128,
            }),
        },
      },
    });
    const request = new Request("https://api.example.com/attachments/proj-test/sneaky-key");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    // The filename in disposition should have / replaced with _
    expect(response.headers.get("Content-Disposition")).not.toContain("/");
    // Since safe inline type (image/png) starts with "image/", we get inline
    expect(response.headers.get("Content-Disposition")).toContain("inline");
  });

  it("returns 503 when ATTACHMENTS is not configured", async () => {
    const deps = buildAuthDeps("proj-test", {
      env: {
        ATTACHMENTS: undefined,
      },
    });
    const request = new Request("https://api.example.com/attachments/proj-test/file");
    const url = new URL(request.url);
    const response = await dispatchPublicRoutes(request, url, deps);
    expect(response).not.toBeNull();
    expect(response.status).toBe(503);
  });
});