export interface FluxyTokenRouteEnv {
  workerUrl: string;
  /** Secret API key (fc_). Never send to the browser. */
  apiKey: string;
  ttlSeconds?: number;
  roles?: string[];
}

export function createFluxyTokenRoute(options: FluxyTokenRouteEnv & {
  getUserId: (request: Request) => Promise<string | null> | string | null;
}) {
  return async function fluxyTokenPost(request: Request): Promise<Response> {
    const userId = await options.getUserId(request);
    if (!userId?.trim()) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const base = options.workerUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fluxy-Api-Key": options.apiKey,
      },
      body: JSON.stringify({
        userId: userId.trim(),
        ttlSeconds: options.ttlSeconds,
        roles: options.roles,
      }),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  };
}

export function clerkUserIdFromAuth(authResult: { userId?: string | null } | null | undefined): string | null {
  const id = authResult?.userId?.trim();
  return id || null;
}

export function userIdFromAuthJsSession(
  session: { user?: { id?: string | null } | null } | null | undefined,
): string | null {
  const id = session?.user?.id?.trim();
  return id || null;
}

/** Next.js App Router: `auth` from `@clerk/nextjs/server`. */
export function createClerkFluxyTokenRoute(
  options: FluxyTokenRouteEnv & { auth: () => Promise<{ userId?: string | null } | null> },
) {
  return createFluxyTokenRoute({
    workerUrl: options.workerUrl,
    apiKey: options.apiKey,
    ttlSeconds: options.ttlSeconds,
    roles: options.roles,
    getUserId: async () => clerkUserIdFromAuth(await options.auth()),
  });
}

/** Auth.js / NextAuth: pass `auth()` from `next-auth`. */
export function createAuthJsFluxyTokenRoute(
  options: FluxyTokenRouteEnv & {
    auth: () => Promise<{ user?: { id?: string | null } | null } | null>;
  },
) {
  return createFluxyTokenRoute({
    workerUrl: options.workerUrl,
    apiKey: options.apiKey,
    ttlSeconds: options.ttlSeconds,
    roles: options.roles,
    getUserId: async () => userIdFromAuthJsSession(await options.auth()),
  });
}

/** Better Auth uses the same `{ user: { id } }` session shape as Auth.js. */
export const userIdFromBetterAuthSession = userIdFromAuthJsSession;

export function createBetterAuthFluxyTokenRoute(
  options: FluxyTokenRouteEnv & {
    auth: () => Promise<{ user?: { id?: string | null } | null } | null>;
  },
) {
  return createAuthJsFluxyTokenRoute(options);
}

/** Lucia `getUser()` / session user with `{ id }`. Same mint path as Auth.js. */
export const userIdFromLuciaUser = userIdFromAuthJsSession;

export function createLuciaFluxyTokenRoute(
  options: FluxyTokenRouteEnv & {
    auth: () => Promise<{ user?: { id?: string | null } | null } | null>;
  },
) {
  return createAuthJsFluxyTokenRoute(options);
}

/** Supabase `auth.getUser()` → `{ data: { user } }`. */
export function userIdFromSupabaseGetUser(
  result: { data?: { user?: { id?: string | null } | null } | null } | null | undefined,
): string | null {
  const id = result?.data?.user?.id?.trim();
  return id || null;
}

export function createSupabaseFluxyTokenRoute(
  options: FluxyTokenRouteEnv & {
    getUser: () => Promise<{ data?: { user?: { id?: string | null } | null } | null }>;
  },
) {
  return createFluxyTokenRoute({
    workerUrl: options.workerUrl,
    apiKey: options.apiKey,
    ttlSeconds: options.ttlSeconds,
    roles: options.roles,
    getUserId: async () => userIdFromSupabaseGetUser(await options.getUser()),
  });
}

/** Auth0 / WorkOS-style `{ user: { sub } }`. `|` and other chars become `_` (Worker `isValidId`). */
export function userIdFromOidcSub(
  session: { user?: { sub?: string | null; id?: string | null } | null } | null | undefined,
): string | null {
  const raw = session?.user?.sub?.trim() || session?.user?.id?.trim() || "";
  if (!raw) return null;
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  return /^[a-zA-Z0-9_-]{1,128}$/.test(safe) ? safe : null;
}

export function createOidcFluxyTokenRoute(
  options: FluxyTokenRouteEnv & {
    auth: () => Promise<{ user?: { sub?: string | null; id?: string | null } | null } | null>;
  },
) {
  return createFluxyTokenRoute({
    workerUrl: options.workerUrl,
    apiKey: options.apiKey,
    ttlSeconds: options.ttlSeconds,
    roles: options.roles,
    getUserId: async () => userIdFromOidcSub(await options.auth()),
  });
}
