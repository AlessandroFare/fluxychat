# @fluxy-chat/auth

Thin wrappers that POST `/auth/token` with `fc_`. Not a Clerk / Auth.js / Supabase SDK. `pk_` cannot mint.

Handmade `getUserId`:

```ts
import { createFluxyTokenRoute } from "@fluxy-chat/auth";

export const POST = createFluxyTokenRoute({
  workerUrl: process.env.FLUXY_BASE_URL!,
  apiKey: process.env.FLUXY_API_KEY!,
  getUserId: async (request) => readYourSession(request),
});
```

Clerk:

```ts
import { auth } from "@clerk/nextjs/server";
import { createClerkFluxyTokenRoute } from "@fluxy-chat/auth";

export const POST = createClerkFluxyTokenRoute({
  workerUrl: process.env.FLUXY_BASE_URL!,
  apiKey: process.env.FLUXY_API_KEY!,
  auth,
});
```

Auth.js / Better Auth / Lucia (`{ user: { id } }`): `createAuthJsFluxyTokenRoute`, `createBetterAuthFluxyTokenRoute`, `createLuciaFluxyTokenRoute`.

Supabase `auth.getUser()`: `createSupabaseFluxyTokenRoute({ getUser: () => supabase.auth.getUser() })`.

Auth0-style `{ user: { sub } }`: `createOidcFluxyTokenRoute`. Characters that are not `[A-Za-z0-9_-]` become `_` so the Worker `userId` check passes (`auth0|1` → `auth0_1`).

Docs: `guides/auth-jwt`.
