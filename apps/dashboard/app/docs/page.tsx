import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { ArrowRight, BookOpen, Cloud, KeyRound, Package, Server, Webhook } from "lucide-react";
import { Button } from "~/components/ui/button";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_COPY, HOSTED_PATHS } from "@/lib/hosted-product";

export const metadata: Metadata = PAGE_METADATA.docs;

const GUIDES = [
  {
    id: "quickstart",
    icon: Cloud,
    title: "Hosted quickstart",
    summary: "Account, SDK install, and first room message on Fluxychat Cloud.",
    href: HOSTED_PATHS.getStarted,
    cta: "Start quickstart",
  },
  {
    id: "auth",
    icon: KeyRound,
    title: "Auth and JWT",
    summary:
      "Keep API keys on the server. Mint member JWTs with POST /auth/token — never expose admin tokens in the browser.",
    href: `${HOSTED_PATHS.docs}#auth`,
    cta: "Auth section",
  },
  {
    id: "sdk",
    icon: Package,
    title: "SDK in your app",
    summary: "FluxyChatClient, useChat, rooms, and WebSocket delivery against hosted or self-hosted Workers.",
    href: `${HOSTED_PATHS.docs}#sdk`,
    cta: "SDK section",
  },
  {
    id: "self-host",
    icon: Server,
    title: "Self-host on Cloudflare",
    summary: "Deploy apps/worker and D1 when you need an isolated tenant or your own compliance boundary.",
    href: `${HOSTED_PATHS.getStarted}#self-host`,
    cta: "Self-host steps",
  },
  {
    id: "webhooks",
    icon: Webhook,
    title: "Webhooks and agents",
    summary: "Room events, AI invokes, and Stripe billing hooks on the Worker.",
    href: `${HOSTED_PATHS.docs}#webhooks`,
    cta: "Webhooks section",
  },
  {
    id: "console",
    icon: BookOpen,
    title: "Operator console",
    summary: "Projects, rooms, analytics, and billing after you connect an account.",
    href: HOSTED_PATHS.onboarding,
    cta: "Open wizard",
  },
] as const;

export default function DocsPage() {
  return (
    <MarketingShell className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Documentation</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-900">Guides and reference</h1>
      <p className="mt-3 text-slate-600">
        Auth, SDK, and deployment notes for Fluxychat. For source and self-host details, use the GitHub monorepo.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.id}
            href={guide.href}
            className="group rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] transition hover:border-primary/20 hover:shadow-md"
          >
            <guide.icon className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-heading text-lg font-semibold text-slate-900">{guide.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.summary}</p>
            <span className="mt-3 inline-flex items-center text-sm font-medium text-primary">
              {guide.cta}
              <ArrowRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <section id="auth" className="mt-14 scroll-mt-24 border-t border-black/[0.06] pt-10">
        <h2 className="font-heading text-xl font-semibold text-slate-900">Auth & JWT</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-slate-800">API key</strong> (<code className="font-mono text-xs">fc_...</code>):
            server-to-server, identifies your project. Store in env on your backend only.
          </p>
          <p>
            <strong className="text-slate-800">JWT</strong>: for browsers and the SDK. Mint with{" "}
            <code className="font-mono text-xs">POST /auth/token</code> and header{" "}
            <code className="font-mono text-xs">X-Fluxy-Api-Key</code>. Claims include{" "}
            <code className="font-mono text-xs">sub</code> (user id),{" "}
            <code className="font-mono text-xs">tid</code> (project id), and <code className="font-mono text-xs">roles</code>.
          </p>
          <p>
            With Clerk enabled, the dashboard provisions your tenant and mints operator JWTs server-side — you do not
            paste bootstrap keys in the browser.
          </p>
        </div>
      </section>

      <section id="sdk" className="mt-12 scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold text-slate-900">SDK</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-[#111111] p-4 text-sm text-slate-100">
          {`pnpm add @fluxychat/sdk\n\nimport { FluxyChatClient, useChat } from "@fluxychat/sdk";\n\nconst client = new FluxyChatClient({\n  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL,\n  userId: "user_123",\n  token: memberJwtFromYourBackend,\n});`}
        </pre>
      </section>

      <section id="webhooks" className="mt-12 scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold text-slate-900">Webhooks & billing</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Configure outbound webhooks per project in the console. Stripe checkout and usage quotas are enforced on the
          Worker — upgrade plans from <Link href="/billing" className="text-primary underline-offset-2 hover:underline">Billing</Link> after you connect an account.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-black/[0.06] pt-8">
        <Button asChild>
          <Link href={HOSTED_PATHS.signUp}>{HOSTED_COPY.startFree}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="https://github.com/AlessandroFare/fluxychat" target="_blank" rel="noreferrer">
            View monorepo on GitHub
          </a>
        </Button>
      </div>
    </MarketingShell>
  );
}
