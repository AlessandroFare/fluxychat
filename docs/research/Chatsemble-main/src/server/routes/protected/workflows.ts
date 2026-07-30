import type { HonoContextWithAuth } from "@server/types/hono";
import { Hono } from "hono";

const app = new Hono<HonoContextWithAuth>().delete(
	"/:workflowId",
	async (c) => {
		const { ORGANIZATION_DURABLE_OBJECT } = c.env;
		const workflowId = c.req.param("workflowId");
		const session = c.get("session");
		const { activeOrganizationId } = session;

		const organizationDoId =
			ORGANIZATION_DURABLE_OBJECT.idFromName(activeOrganizationId);
		const organizationDo = ORGANIZATION_DURABLE_OBJECT.get(organizationDoId);

		await organizationDo.deleteWorkflow(workflowId);

		return c.json({
			success: true,
		});
	},
);

export default app;
