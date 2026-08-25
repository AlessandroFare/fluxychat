import { describe, expect, it } from "vitest";
import { dispatchMcpRoutes } from "./mcp-http.js";
import { MCP_PROTOCOL_VERSION } from "../lib/mcp-protocol.js";

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  return {
    env: { DB: { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }) }) } },
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders, ...(init.headers || {}) },
      }),
    corsHeaders,
    requestLogCtx: { traceId: "t" },
    verifyJwtAndGetContext:
      overrides.verifyJwt ??
      (async () => ({
        userId: "user_1",
        projectId: "proj_1",
        roles: ["member"],
      })),
    logError: () => {},
  };
}

describe("dispatchMcpRoutes conformance", () => {
  it("serves OAuth protected resource metadata without JWT", async () => {
    const res = await dispatchMcpRoutes(
      new Request("http://chat.example/.well-known/oauth-protected-resource"),
      new URL("http://chat.example/.well-known/oauth-protected-resource"),
      buildDeps({ verifyJwt: async () => null }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resource).toBe("http://chat.example/mcp");
    expect(body.bearer_methods_supported).toContain("header");
  });

  it("returns 401 with WWW-Authenticate on POST /mcp without JWT", async () => {
    const res = await dispatchMcpRoutes(
      new Request("http://chat.example/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover" }),
      }),
      new URL("http://chat.example/mcp"),
      buildDeps({ verifyJwt: async () => null }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("resource_metadata=");
  });

  it("returns 405 for GET /mcp", async () => {
    const res = await dispatchMcpRoutes(
      new Request("http://chat.example/mcp"),
      new URL("http://chat.example/mcp"),
      buildDeps(),
    );
    expect(res.status).toBe(405);
  });

  it("answers server/discover on POST /mcp", async () => {
    const res = await dispatchMcpRoutes(
      new Request("http://chat.example/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
          "Mcp-Method": "server/discover",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "d1",
          method: "server/discover",
          params: { _meta: { "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION } },
        }),
      }),
      new URL("http://chat.example/mcp"),
      buildDeps(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.supportedVersions).toContain(MCP_PROTOCOL_VERSION);
    expect(body.result.capabilities.elicitation).toBeDefined();
  });
});
