# Adapter permission manifest (curated)

This package is **not** a public ClawHub-style catalog. Listing requires a GitHub PR to vercel/chat after npm publish. Until then treat it as first-party.

## Permissions the adapter needs

| Capability | Why |
|------------|-----|
| `postMessage` | Send as the signed-in user |
| `fetchMessages` | Read room history the user can see |
| `listThreads` | Nested `parentId` threads |
| edit / delete | Same ACL as the Worker |

It does **not** mint `pk_`, read other tenants, or run `invokeAgent` unless the host app calls the Worker with a member JWT.

Unsigned third-party adapters must not be loaded from a URL. Sandbox + signed manifests are a later product; until then only this repo (or a fork you control).
