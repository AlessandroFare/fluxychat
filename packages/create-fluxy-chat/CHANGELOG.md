# Changelog

## [0.5.13] - 2026-08-27

### Changed

- Templates pin `@fluxy-chat/sdk@^0.6.4` (game `listLeaderboard`). Publish `@fluxy-chat/sdk@0.6.4` **before** this CLI, or `pnpm create` / StackBlitz will miss that version.

## [0.5.12] - 2026-08-26

### Added

- Gallery `--example` apps: `live-cursors`, `live-cursors-chat`, `javascript-live-cursors`, `tiptap-room`, `whiteboard`, `draw`, `comments-board`, `war-room`, `iot-panel`, `deal-room`, `fleet-panel`, `game-tick`, `voice-stage`.

### Changed

- Templates that use React pin `@fluxy-chat/react@^0.1.4`. Publish `@fluxy-chat/protocol@0.1.5` and `@fluxy-chat/react@0.1.4` **before** this CLI, or `pnpm create` / StackBlitz will miss those versions.

## [0.5.11] - 2026-08-25

### Added

- React and full templates expose `stopAgentStream` (Stop / Stop generation) while an agent reply is streaming. Comes from `@fluxy-chat/sdk@0.6.3` via `useChat`.

### Changed

- Templates pin `@fluxy-chat/sdk@^0.6.3`, `@fluxy-chat/react@^0.1.3`, `@fluxy-chat/ui@^0.1.4`, and `@fluxy-chat/ui-kit@^0.1.1` (minimal). Publish those packages **before** this CLI, or `pnpm create` will 404.

## [0.5.10] - 2026-08-25

### Added

- Gold-path outro mentions `@assistant` in the generated React app.

### Changed

- Templates still depend on `@fluxy-chat/sdk@^0.6.2` (and `@fluxy-chat/react@^0.1.2` where used) so `pnpm create` works **before and after** sdk `0.6.3` is on npm. `^0.6.2` installs `0.6.3` once published.

## [0.5.9] - 2026-08-21

### Added

- `--mode self-host` (alias of `local`). Interactive Worker URL, console URL, and optional Groq key. Writes `.fluxy/answers.json` and `.fluxy/worker.dev.vars` to paste into `apps/worker/.dev.vars`.
- `pnpm setup:self-host` on the full template. If the Worker is down, setup asks for a URL instead of exiting immediately.

## [0.5.8] - 2026-08-19

### Fixed

- After `pnpm install`, remove a nested `@fluxy-chat/sdk@0.6.0` (incomplete tarball pulled in by `@fluxy-chat/react@0.1.1`) so Vite uses the complete 0.6.2 package.

## [0.5.7] - 2026-08-19

### Fixed

- Remove Vite alias to `@fluxy-chat/ui/dist/index.js` (that path is not in package `exports`; import `@fluxy-chat/ui` instead).
- Depend on `@fluxy-chat/ui@^0.1.4`.

## [0.5.6] - 2026-08-19

### Changed

- Hosted `full` template opens a local onboarding tour first. Clerk sign-in is the last step, then you land on a simple chat (same UI primitives as the console). Open a second tab to try realtime. Dashboard is a separate button, not the first screen.

### Fixed

- Force `@fluxy-chat/sdk@0.6.2` via pnpm overrides so `pnpm install` + `pnpm dev` work without extra setup.
- Depend on `@fluxy-chat/ui@^0.1.3` (valid package exports).

## [0.5.5] - 2026-08-19

### Fixed

- Hosted `full` template now provisions a user project + assistant room via Clerk (no more public playground session).
- Hosted `full` template uses the same chat UI primitives as FluxyChat (message bubbles/composer/status) to match dashboard/rooms/onboarding styling.
- Remove fuorvianti "dash" UI artifacts and wire message sending through the same chat path as the dashboard.

## [0.5.4] - 2026-08-19

### Fixed

- Add `zustand` to `full` template dependencies so `pnpm install` gets everything without manual intervention.
- Fix `FluxyRealtimeProvider` usage: pass `workerUrl` + `authTokenProvider` instead of non-existent `client` prop (fixes "disconnected" state and message sending).
- Restyle full template UI to match FluxyChat dark theme (indigo/emerald palette, proper message bubbles, live/disconnected badge).

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
