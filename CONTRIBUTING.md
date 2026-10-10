# Contributing

Small PRs. Search issues first. Match the TypeScript style already in the tree.

## Before you open a PR

1. Search existing issues.
2. One feature or fix per PR when you can.
3. Match the TypeScript already in the tree. Worker routes live under `apps/worker/src/routes/`.
4. Add or update Vitest tests when behavior changes.
5. Update MDX in `apps/docs/content/docs/` when user-facing behavior changes.

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

## Releasing

See [RELEASING.md](RELEASING.md). Do not paste npm publish steps into the root README.

## Security

Email support@fluxychat.com. Do not open a public issue for an exploitable bug.

## License

By contributing, you agree your contributions are licensed under the same license as the project (see repository `LICENSE`, currently MIT).

Each commit must include a Developer Certificate of Origin sign-off (`DCO` in the repo root):

```
Signed-off-by: Your Name <you@example.com>
```

Git: `git commit -s`. A CLA is not collected yet. Relicensing (Apache-2.0 patent grant, or a separable enterprise folder for SSO/SCIM/hybrid control plane) is not happening until there are users. Do not move SSO/SCIM into a closed tree in this PR cycle.


## Community norms

- Be direct and kind in reviews.
- Prefer build-first solutions (OSS/self-host) over paid SaaS dependencies unless explicitly discussed.
- Marketing-only PRs (case studies, launch copy) wait.
