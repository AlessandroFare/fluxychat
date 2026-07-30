# [cf-chat] CloudFlare Chat

A chat webapp using websockets and CloudFlare's workers with durable objects,
in TypeScript.  Includes a few examples of non-chat actions (e.g., useful in a
multi-player game or other realtime simulation with streaming updates).

Uses the following technologies:

* Nuxt.js framework to keep code uncluttered and organized
* Durable Object storage to maintain the chat logs and websocket connections
* D1 (cloudflare's managed database) for indexing users and logs
* Kinde for registering and authenticating users on the site
* 


## Dependencies

- a **CloudFlare** account with "Workers paid" subscription ($5/month)

- **Node** (for local dev of workers) and **pnpm**, **npx**.

- **wrangler** for interacting with CloudFlare (executed via **npx**).

> [!NOTE]
> It is possible to modify this application to fit entirely within the free
> tier, but you miss out on websockets and a significant increase in quotas.
>
> You would have to store everything on D1 and keep some workers running
> constantly, while Durable Objects can sleep between websocket messages (if
> configured correctly using Cloudflare's API) and provide extra non-D1 storage.


## Setup

1. [ ] authenticate against CF with Wrangler

```console
cf-chat$ npx wrangler login
```

2. [ ] deploy this repo's workers code to your application

```console
cf-chat$ npx wrangler deploy
```

The project ID and other details are found in `wrangler.toml`:

- project ID in `name` and the main entry point in `main` at top-level scope
- durable objects binding
- view HTML in [[rules]]
- associate classes with durable objects in [[migrations]]

3. [ ] Visit `*.workers.dev` subdomain, optional: connect a custom domain.

 - if connecting a custom domain with subdomain, add to routes in `wrangler.toml`

 - [ ] Ensure TLS is turned on, and HSTS, for the domain/subdomain used.

4. [ ] Test the chat interaction (open with multiple browser tabs)


Also check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment)
of Nuxt.js for more information.

## Adding an action to the chat

<!-- TODO -->


## Uninstalling

To remove the durable objects instances, remove the `[durable_objects]` bindings
and add a deleted_classes property to the `[[migrations]]` section with an
updated version, e.g.:

```toml
[durable_objects]
bindings = [
]

[[migrations]]
tag = "v1" # first version, already defined in repo
new_classes = ["ChatRoom", "RateLimiter"]

[[migrations]]
tag = "v2" # modified version, adding some game actions
new_classes = ["GameState"]

[[migrations]]
tag = "v3" # deletion migration
deleted_classes = ["ChatRoom", "GameState", "RateLimiter"]
```

