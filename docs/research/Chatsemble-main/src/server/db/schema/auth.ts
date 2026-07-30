import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

// User table
export const user = sqliteTable("user", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// Session table
export const session = sqliteTable("session", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	token: text("token").notNull().unique(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	activeOrganizationId: text("active_organization_id"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

// Organization table
export const organization = sqliteTable("organization", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	metadata: text("metadata", { mode: "json" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// Member table
export const organizationMember = sqliteTable("organization_member", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id),
	role: text("role").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// Invitation table
export const organizationInvitation = sqliteTable("organization_invitation", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	email: text("email").notNull(),
	inviterId: text("inviter_id")
		.notNull()
		.references(() => user.id),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id),
	role: text("role").notNull(),
	status: text("status").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// Account table
export const account = sqliteTable("account", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	userId: text("user_id")
		.notNull()
		.references(() => user.id),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp_ms",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp_ms",
	}),
	scope: text("scope"),
	idToken: text("id_token"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// Verification table
export const verification = sqliteTable("verification", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => nanoid(36)),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});
