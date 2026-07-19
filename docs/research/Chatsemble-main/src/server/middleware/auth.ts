import { auth } from "@server/auth";
import type { HonoContext } from "@server/types/hono";
import type { Context, Next } from "hono";

export const honoAuthMiddleware = async (
	c: Context<HonoContext>,
	next: Next,
) => {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	c.set("user", session?.user ?? null);
	c.set("session", session?.session ?? null);
	await next();
};

export const honoAuthCheckMiddleware = async (
	c: Context<HonoContext>,
	next: Next,
) => {
	const session = c.get("session");
	const user = c.get("user");

	if (!session || !user || !session.activeOrganizationId) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("user", user);
	c.set("session", session);
	await next();
};
