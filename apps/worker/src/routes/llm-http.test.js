import { describe, expect, it, vi } from "vitest";
import { dispatchLlmRoutes } from "./llm-http.js";

function buildDeps(overrides = {}) {
  const corsHeaders = { "access-control-allow-origin": "*" };
  const db = overrides.db ?? {
    prepare() {
      return {
        bind() {
          return {
            first: async () => null,
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  };

  return {
    // Audit F-02: user-supplied base URLs must be on the operator allowlist.
    env: { DB: db, LLM_SECRETS_KEY: "", ALLOWED_SSRF_HOSTS: "api.example.com" },
    corsHeaders,
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: { "content-type": "application/json", ...corsHeaders },
      }),
    verifyJwtAndGetContext:
      overrides.verifyJwt ??
      (async () => ({ userId: "u1", projectId: "p1", roles: ["member"] })),
    hasAnyRole: (roles, allowed) => (roles || []).some((r) => allowed.includes(r)),
    projectId: (auth) => auth.projectId,
    listLlmProvidersForApi: async () => ({ providers: [] }),
  };
}

function putRequest(provider = "custom", body = {}) {
  return new Request(`http://127.0.0.1:8787/projects/llm/credentials/${provider}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("dispatchLlmRoutes credentials (audit F-23)", () => {
  it("rejects member PUT with 403", async () => {
    const h = buildDeps();
    const req = putRequest("custom", { baseUrl: "https://api.example.com/v1" });
    const res = await dispatchLlmRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("rejects member DELETE with 403", async () => {
    const h = buildDeps();
    const req = new Request("http://127.0.0.1:8787/projects/llm/credentials/custom", {
      method: "DELETE",
    });
    const res = await dispatchLlmRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(403);
  });

  it("owner can save a public baseUrl", async () => {
    const h = buildDeps({
      verifyJwt: async () => ({ userId: "u1", projectId: "p1", roles: ["owner"] }),
    });
    const req = putRequest("custom", { baseUrl: "https://api.example.com/v1" });
    const res = await dispatchLlmRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credential.baseUrl).toBe("https://api.example.com/v1");
  });

  it("owner cannot point baseUrl at internal hosts", async () => {
    const h = buildDeps({
      verifyJwt: async () => ({ userId: "u1", projectId: "p1", roles: ["owner"] }),
    });
    const req = putRequest("custom", { baseUrl: "http://10.0.0.5:8000/v1" });
    const res = await dispatchLlmRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("base_url_not_allowed");
  });

  it("owner can allowlist an internal host via ALLOWED_SSRF_HOSTS", async () => {
    const h = buildDeps({
      verifyJwt: async () => ({ userId: "u1", projectId: "p1", roles: ["owner"] }),
    });
    h.env.ALLOWED_SSRF_HOSTS = "ollama.internal";
    const req = putRequest("custom", { baseUrl: "http://ollama.internal:11434/v1" });
    const res = await dispatchLlmRoutes(req, new URL(req.url), h);
    expect(res.status).toBe(200);
  });
});
