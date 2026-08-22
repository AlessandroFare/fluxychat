import { Hono } from "hono";
import { isAdminAuthRequired } from "./admin-auth-flag.js";

export const MAX_HTTP_BODY_BYTES = 1_048_576;

/**
 * Hono shell around the existing Worker fetch handler.
 * Adds a body-size cap and a fail-closed Bearer check on /admin/* before
 * the O(prefix) dispatcher runs. OPTIONS preflight skips the Bearer check
 * so the inner handler can return CORS headers.
 *
 * @param {(request: Request, env: *, ctx: *) => Promise<Response>} innerFetch
 */
export function createHttpGateApp(innerFetch) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const contentLength = Number(c.req.header("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_HTTP_BODY_BYTES) {
      return c.json({ error: "payload_too_large" }, 413);
    }
    await next();
  });

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      await next();
      return;
    }
    const path = new URL(c.req.url).pathname;
    const isAdminPath = path === "/admin" || path.startsWith("/admin/");
    if (isAdminPath && isAdminAuthRequired(c.env) && requestLacksBearer(c.req.raw)) {
      return c.text("Unauthorized", 401);
    }
    await next();
  });

  app.all("*", (c) => innerFetch(c.req.raw, c.env, c.executionCtx));
  return app;
}

function requestLacksBearer(request) {
  const header = request.headers.get("authorization") || "";
  return !header.toLowerCase().startsWith("bearer ");
}
