import { organizationPermissions } from "@server/auth/organization-permissions";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const API_HOST = import.meta.env.VITE_APP_URL || "http://localhost:5173";

export const authClient = createAuthClient({
	baseURL: API_HOST,
	plugins: [
		organizationClient({
			ac: organizationPermissions.accessControl,
			roles: {
				member: organizationPermissions.member,
				admin: organizationPermissions.admin,
				owner: organizationPermissions.owner,
			},
		}),
	],
});
