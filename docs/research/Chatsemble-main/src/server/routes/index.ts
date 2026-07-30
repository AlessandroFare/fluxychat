import { env } from "cloudflare:workers";
import { auth } from "@server/auth";
import protectedRoutes from "@server/routes/protected";
import websocketOrganizationRoutes from "@server/routes/websocket/organization";
import type { HonoContext } from "@server/types/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
export const app = new Hono<HonoContext>().use(
	"/api/*",
	cors({
		origin: env.APP_URL,
		allowMethods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

const routes = app
	.route("/api", protectedRoutes)
	.route("/websocket", websocketOrganizationRoutes);

app.all("*", async (c) => {
	return c.env.ASSETS.fetch(c.req.raw);
});

export type AppType = typeof routes;
