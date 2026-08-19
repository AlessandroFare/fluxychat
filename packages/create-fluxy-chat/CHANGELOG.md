# Changelog

## [0.5.4] - 2026-08-19

### Fixed

- Add `zustand` to `full` template dependencies so `pnpm install` gets everything without manual intervention.
- Fix `FluxyRealtimeProvider` usage: pass `workerUrl` + `authTokenProvider` instead of non-existent `client` prop (fixes "disconnected" state and message sending).
- Restyle full template UI to match FluxyChat dark theme (indigo/emerald palette, proper message bubbles, live/disconnected badge).

## [0.5.5] - 2026-08-19

### Fixed

- Hosted `full` template now provisions a user project + assistant room via Clerk (no more public playground session).
- Hosted `full` template uses the same chat UI primitives as FluxyChat (message bubbles/composer/status) to match dashboard/rooms/onboarding styling.
- Remove fuorvianti "dash" UI artifacts and wire message sending through the same chat path as the dashboard.

## [0.5.3] - 2026-08-19

### Fixed

- Require `@fluxy-chat/sdk@^0.6.2` (v0.6.1 tarball was missing dist files).

## [0.5.2] - 2026-08-19

### Fixed

- Send `Origin` header in hosted setup script so `/demo/session` passes the `DEMO_ALLOWED_ORIGINS` guard.

## [0.5.1] - 2026-08-19

### Changed

- Docs and CLI help use the scoped npm name: `npx @fluxy-chat/create-fluxy-chat@latest` (unscoped `create-fluxy-chat` 404s on the registry)

## [0.5.0] - 2026-08-19

### Added

- `--full` / `--template full` — Vite app with realtime chat, `@assistant` invoke, and tool thread
- `--mode hosted` — guest JWT via `GET /demo/session` (no local wrangler)
- `--mode local` — provision against a local worker (`POST /dev/provision`)
- Template scripts: `pnpm setup`, `pnpm setup:hosted`, `pnpm doctor`, `pnpm dev`
- CLI next-steps link to `/onboarding?from=cli` (keep / import `.env`)

### Changed

- Interactive picker lists Full stack first
- README hero documents hosted vs local paths
