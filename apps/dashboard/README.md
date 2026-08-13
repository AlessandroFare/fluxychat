# FluxyChat dashboard

Next.js app for [fluxychat.com](https://fluxychat.com): marketing pages, operator console, onboarding wizard, and in-app docs/guides.

## Local dev

From the repo root:

```bash
pnpm install
pnpm run dev:setup
pnpm --filter @fluxy-chat/dashboard dev
```

Open [http://localhost:3000](http://localhost:3000). The quickstart lives at `/onboarding`.

## Environment

Copy templates via `pnpm run dev:setup` or manually:

- `apps/dashboard/.env.local` from `.env.example`
- Worker secrets in `apps/worker/.dev.vars` (the dashboard calls the Worker URL from `NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL` or `WORKER_URL`)

## User-facing copy

Marketing and console strings live in:

- `lib/marketing-landing.ts`, `lib/marketing-copy.ts`, `lib/marketing-faq.ts`
- `lib/why-copy.ts`, `lib/compare-providers.ts`
- `app/landing/*` and individual `app/**/page.tsx` headers

Public product docs are published separately at [docs.fluxychat.com](https://docs.fluxychat.com) from `apps/docs`.

## Related

- [Dashboard integration (repo docs)](../docs/dashboard-integration.md)
- [Root README](../../README.md)
