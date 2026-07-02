import { describe, expect, it } from "vitest";
import agent from "./agent.js";

function createRequest(method, path, origin) {
  const headers = new Headers();
  if (origin) {
    headers.set("Origin", origin);
  }
  return new Request(`https://example.com${path}`, { method, headers });
}

function createCtx() {
  return { waitUntil: () => {} };
}

describe("CORS handling", () => {
  it("reflects an allowed origin in production", async () => {
    const env = {
      ENVIRONMENT: "production",
      ALLOWED_ORIGINS: "https://app.example.com",
    };
    const res = await agent.fetch(
      createRequest("GET", "/health", "https://app.example.com"),
      env,
      createCtx()
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.example.com"
    );
  });

  it("omits the CORS origin header for a disallowed origin in production", async () => {
    const env = {
      ENVIRONMENT: "production",
      ALLOWED_ORIGINS: "https://app.example.com",
    };
    const res = await agent.fetch(
      createRequest("GET", "/health", "https://evil.com"),
      env,
      createCtx()
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("falls back to wildcard in development", async () => {
    const env = { ENVIRONMENT: "development" };
    const res = await agent.fetch(
      createRequest("OPTIONS", "/health", "https://any.com"),
      env,
      createCtx()
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("does not use wildcard in production even when ALLOWED_ORIGINS is *", async () => {
    const env = { ENVIRONMENT: "production", ALLOWED_ORIGINS: "*" };
    const res = await agent.fetch(
      createRequest("GET", "/health", "https://any.com"),
      env,
      createCtx()
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("recognizes NODE_ENV as a development signal", async () => {
    const env = { NODE_ENV: "development" };
    const res = await agent.fetch(
      createRequest("OPTIONS", "/health", "https://any.com"),
      env,
      createCtx()
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
