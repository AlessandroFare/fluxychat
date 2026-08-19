# Changelog

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
