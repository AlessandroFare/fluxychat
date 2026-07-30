import { env } from "cloudflare:workers";
import { organizationPermissions } from "@server/auth/organization-permissions";
import { db } from "@server/db";
import * as globalSchema from "@server/db/schema";
import { sendMail } from "@server/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
	appName: "Chatsemble",
	baseURL: env.APP_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: [env.APP_URL],
	database: drizzleAdapter(db, {
		provider: "sqlite",
	}),
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			await sendMail(user.email, "email-verification", {
				verificationUrl: url,
				username: user.email,
			});
		},
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendMail(user.email, "password-reset", {
				resetLink: url,
				username: user.email,
			});
		},
	},
	plugins: [
		organization({
			ac: organizationPermissions.accessControl,
			roles: {
				member: organizationPermissions.member,
				admin: organizationPermissions.admin,
				owner: organizationPermissions.owner,
			},
			schema: {
				member: {
					modelName: "organizationMember",
				},
				invitation: {
					modelName: "organizationInvitation",
				},
			},
			sendInvitationEmail: async (data) => {
				const url = `${env.APP_URL}/auth/accept-invitation/${data.id}`;
				await sendMail(data.email, "organization-invitation", {
					inviteLink: url,
					username: data.email,
					invitedByUsername: data.inviter.user.name,
					invitedByEmail: data.inviter.user.email,
					teamName: data.organization.name,
				});
			},
		}),
	],
	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					const orgSession = await db.query.organizationMember.findFirst({
						where: eq(globalSchema.organizationMember.userId, session.userId),
					});

					return {
						data: {
							...session,
							activeOrganizationId: orgSession?.organizationId ?? null,
						},
					};
				},
			},
		},
	},
});
