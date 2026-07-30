# Contributing to FluxyChat

Thanks for helping make FluxyChat the reference stack for chat + AI on Cloudflare Workers. This guide covers the essentials — no corporate process, just clear expectations.

## Before you open a PR

1. **Search existing issues** — avoid duplicate work.
2. **Small PRs win** — one feature or fix per PR when possible.
3. **Match repo conventions** — TypeScript functional style, Vue/React Composition API in apps, worker routes under `apps/worker/src/routes/`.
4. **Tests** — add or update Vitest tests for worker/lib and SDK changes when behavior changes.
5. **Docs** — update MDX in `apps/docs/content/docs/` when user-facing behavior changes.

## Development setup

```bash
pnpm install
pnpm dev:setup          # optional local bootstrap
pnpm --filter @fluxy-chat/worker dev   # Worker on :8787
pnpm --filter @fluxy-chat/dashboard dev
```

Quick smoke: `pnpm first-message` (requires local worker).

## Project layout

| Path | Purpose |
|------|---------|
| `apps/worker/` | Cloudflare Worker + Durable Objects |
| `apps/dashboard/` | Operator console (Next.js) |
| `apps/docs/` | Fumadocs site |
| `packages/sdk/` | Browser/Node client (`@fluxy-chat/sdk`) |
| `packages/react/` | React hooks (`@fluxy-chat/react`) |
| `packages/protocol/` | Wire protocol types |
| `docs/BEAT-PORTAL-ROADMAP.md` | Product engineering roadmap |

## Pull request checklist

- [ ] `pnpm test` passes for affected packages
- [ ] No secrets or `.env` files committed
- [ ] Dashboard changes tested with admin JWT from `/projects`
- [ ] Roadmap checkbox updated if completing a tracked item (optional but appreciated)

## Issue labels (maintainers)

| Label | Meaning |
|-------|---------|
| `good first issue` | Scoped, documented starter task |
| `help wanted` | Design agreed, needs implementation |
| `bug` | Broken behavior vs docs or spec |
| `enhancement` | New capability aligned with roadmap |

## Security

Report vulnerabilities privately — do not open public issues for exploitable bugs. Include reproduction steps and impact.

## License

By contributing, you agree your contributions are licensed under the same license as the project (see repository `LICENSE`).

## Community norms

- Be direct and kind in reviews.
- Prefer build-first solutions (OSS/self-host) over paid SaaS dependencies unless explicitly discussed.
- Marketing-only PRs (case studies, launch copy) are lower priority — see `docs/BEAT-PORTAL-ROADMAP.md` Fase 4 marketing deferrals.
