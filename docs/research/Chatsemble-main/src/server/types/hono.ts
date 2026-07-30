/// <reference path="../../../worker-configuration.d.ts" />

import type { auth } from "@server/auth";

type Auth = typeof auth;

export type HonoContext = {
	Bindings: Env;
	Variables: {
		user: Auth["$Infer"]["Session"]["user"] | null;
		session: Auth["$Infer"]["Session"]["session"] | null;
	};
};

export type HonoContextWithAuth = HonoContext & {
	Variables: HonoContext["Variables"] & {
		user: NonNullable<HonoContext["Variables"]["user"]>;
		session: NonNullable<HonoContext["Variables"]["session"]> & {
			activeOrganizationId: string;
		};
	};
};
