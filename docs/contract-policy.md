# Public contract & changelog policy

This policy defines how **public endpoints** (`/agents`, `/stats/*`, SDK) evolve without breaking integrations.

## “Public” scope

We treat as **public contract**:

- HTTP API:
  - `/auth/token`
  - `/messages`, `/rooms`, `/ws/room/*`
  - `/agents*`
  - `/stats/*`
- Webhook payload + headers (`X-Fluxy-*`)
- SDK (`@fluxy-chat/sdk`): exported public APIs

## Versioning

- **SDK**: Semantic Versioning (SemVer) `MAJOR.MINOR.PATCH`
  - **PATCH**: bugfix, docs, performance, no breaking changes
  - **MINOR**: compatible new features, optional fields/endpoints
  - **MAJOR**: breaking changes (removals, renames, semantic changes)
- **HTTP API**: default “v1 compatible”
  - Breaking changes only with a new base path (e.g. `/v2/...`) or an explicit feature flag.

## HTTP compatibility rules

Allowed without a major bump:

- add new JSON fields
- add new endpoints
- add new optional values for existing fields
- add new non-required headers

Breaking change (avoid in v1):

- remove/rename fields or endpoints
- change field semantics
- make an optional field required
- change success/error HTTP codes incompatibly

## Deprecation policy

When deprecating:

- keep compatibility for at least **1 minor SDK release** or **30 days** (HTTP) before removal.
- document in `CHANGELOG.md`:
  - what is deprecated
  - alternative
  - target removal date

Example:

- `/bots/*` remains compatible but is **deprecated** in favor of `/agents/*`.

## Error contract

Rules:

- JSON error responses should use a stable `error` string when possible
- `401` = missing/invalid/expired auth
- `403` = forbidden (role/membership)
- `429` = rate limited (always with `Retry-After`)

## Changelog

- every significant release updates `CHANGELOG.md`
- include:
  - Added / Changed / Fixed / Deprecated / Removed / Security
  - D1 migration notes (tag/migration id)
