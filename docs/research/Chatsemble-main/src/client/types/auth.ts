import type { authClient } from "@client/lib/auth-client";

export type ActiveOrganization = typeof authClient.$Infer.ActiveOrganization;
export type Invitation = typeof authClient.$Infer.Invitation;
export type Session = typeof authClient.$Infer.Session;
