import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { ArrowRight, BookOpen, Bot, Cloud, Code2, ExternalLink, KeyRound, Package, Server, Sparkles, Webhook, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { MarketingShell } from "../components/marketing-shell";
import { StackBlitzButton } from "@/components/stackblitz-button";
import { STACKBLITZ_TEMPLATES } from "@/lib/stackblitz-templates";
import { HOSTED_COPY, HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { DocsSearch } from "@/components/doc-search";

export const metadata: Metadata = PAGE_METADATA.docs;

const GUIDES = [
  {
    id: "full-docs",
    icon: ExternalLink,
    title: "Full documentation site",
    summary: "Search, Ask AI, SDK reference, platform modules, cookbooks, and 160+ pages on docs.fluxychat.com.",
    href: docsSiteHref(""),
    cta: "Open docs site",
    external: true,
  },
  {
    id: "quickstart",
    icon: Cloud,
    title: "Hosted quickstart",
    summary: "Account, SDK install, and first room message on Fluxychat Cloud.",
    href: docsSiteHref("getting-started/quickstart"),
    cta: "Quickstart",
    external: true,
  },
  {
    id: "auth",
    icon: KeyRound,
    title: "Auth and JWT",
    summary:
      "Keep API keys on the server. Mint member JWTs with POST /auth/token. Never expose admin tokens in the browser.",
    href: docsSiteHref("cookbook/auth-jwt"),
    cta: "Auth guide",
    external: true,
  },
  {
    id: "sdk",
    icon: Package,
    title: "SDK in your app",
    summary: "FluxyChatClient, useChat, rooms, and WebSocket delivery against hosted or self-hosted Workers.",
    href: docsSiteHref("core/use-chat"),
    cta: "SDK reference",
    external: true,
  },
  {
    id: "self-host",
    icon: Server,
    title: "Self-host on Cloudflare",
    summary: "Deploy apps/worker and D1 when you need an isolated tenant or your own compliance boundary.",
    href: docsSiteHref("guides/self-host-one-command"),
    cta: "Self-host guide",
    external: true,
  },
  {
    id: "webhooks",
    icon: Webhook,
    title: "Webhooks and agents",
    summary: "Room events, AI invokes, and Stripe billing hooks on the Worker.",
    href: docsSiteHref("core/agents"),
    cta: "Agents docs",
    external: true,
  },
  {
    id: "platform",
    icon: Zap,
    title: "Platform modules",
    summary: "FluxyStream, FluxyCollab, FluxyGame, and FluxyIoT on the same room and worker as chat.",
    href: docsSiteHref("platform/overview"),
    cta: "Platform overview",
    external: true,
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
    <MarketingShell>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Documentation</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">Guides and reference</h1>
        </div>
        <div className="shrink-0 sm:pt-1">
          <Button asChild>
            <a href={docsSiteHref("")} target="_blank" rel="noopener noreferrer">
              Full docs site
              <ExternalLink className="ml-2 size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
      <div className="mt-6 max-w-md">
        <DocsSearch variant="light" />
      </div>
      <p className="mt-3 text-muted-foreground">
        This page is a quick hub on fluxychat.com. Search, Ask AI, and the full SDK reference live on{" "}
        <a href={docsSiteHref("")} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
          the docs site
        </a>
        . Try the product without signup on{" "}
        <Link href="/demo" className="text-primary underline underline-offset-2">
          /demo
        </Link>
        . SEO guides also live under{" "}
        <Link href={HOSTED_PATHS.guides} className="text-primary underline underline-offset-2">
          /guides
        </Link>
        .
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => {
          const external = "external" in guide && guide.external;
          const inner = (
            <>
              <guide.icon className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-3 font-heading text-lg font-semibold text-foreground">{guide.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.summary}</p>
              <span className="mt-3 inline-flex items-center text-sm font-medium text-primary">
                {guide.cta}
                <ArrowRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </>
          );
          if (external) {
            return (
              <a
                key={guide.id}
                href={guide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-subtle-2)] transition hover:border-primary/20 hover:shadow-md"
              >
                {inner}
              </a>
            );
          }
          return (
            <Link
              key={guide.id}
              href={guide.href}
              className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-subtle-2)] transition hover:border-primary/20 hover:shadow-md"
            >
              {inner}
            </Link>
          );
        })}
      </div>

      <section id="auth" className="mt-14 scroll-mt-24 border-t border-border pt-10">
        <h2 className="font-heading text-xl font-semibold text-foreground">Auth & JWT</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">API key</strong> (<code className="font-mono text-xs">fc_...</code>):
            server-to-server, identifies your project. Store in env on your backend only.
          </p>
          <p>
            <strong className="text-foreground">JWT</strong>: for browsers and the SDK. Mint with{" "}
            <code className="font-mono text-xs">POST /auth/token</code> and header{" "}
            <code className="font-mono text-xs">X-Fluxy-Api-Key</code>. Claims include{" "}
            <code className="font-mono text-xs">sub</code> (user id),{" "}
            <code className="font-mono text-xs">tid</code> (project id), and <code className="font-mono text-xs">roles</code>.
          </p>
          <p>
            With Clerk enabled, the dashboard provisions your tenant and mints operator JWTs server-side. You do not
            paste bootstrap keys in the browser.
          </p>
        </div>
      </section>

      <section id="sdk" className="mt-12 scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold text-foreground">SDK</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">
          {`pnpm add @fluxy-chat/sdk @fluxy-chat/react\n\nimport { FluxyChatClient } from "@fluxy-chat/sdk";\nimport { useChat } from "@fluxy-chat/react";\n\nconst client = new FluxyChatClient({\n  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL,\n  userId: "user_123",\n  token: memberJwtFromYourBackend,\n});`}
        </pre>
        <h3 className="mt-6 font-heading text-base font-semibold text-foreground">Flutter (Dart)</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Native Dart SDK for cross-platform apps. Install from{" "}
          <a
            href="https://pub.dev/packages/fluxychat_sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            pub.dev
          </a>
          .
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">
          {`flutter pub add fluxychat_sdk\n\nimport 'package:fluxychat_sdk/fluxychat_sdk.dart';\n\nfinal client = FluxyChatClient(\n  config: FluxyChatConfig(\n    apiUrl: 'https://your-worker.workers.dev',\n    wsUrl: 'wss://your-worker.workers.dev',\n    projectId: 'proj_123',\n    token: 'your-jwt-token',\n  ),\n);`}
        </pre>
      </section>

      <section id="interactive" className="mt-14 scroll-mt-24 border-t border-border pt-10">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Interactive examples
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Run live FluxyChat SDK examples in your browser via StackBlitz. No setup required.
          Each project is fully configured with the SDK and a public demo endpoint.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {STACKBLITZ_TEMPLATES.map((tmpl) => {
            const Icon =
              tmpl.id === "basic-connection"
                ? Zap
                : tmpl.id === "react-chat-ui"
                  ? Code2
                  : tmpl.id === "full-hosted"
                    ? Sparkles
                    : Bot;
            return (
              <div
                key={tmpl.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-subtle-2)]"
              >
                <Icon className="size-5 text-primary" aria-hidden />
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{tmpl.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>
                <div className="mt-auto pt-1">
                  <StackBlitzButton templateId={tmpl.id} label="Open in StackBlitz" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="webhooks" className="mt-12 scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold text-foreground">Webhooks & billing</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Configure outbound webhooks per project in the console. Stripe checkout and usage quotas are enforced on the
          Worker  upgrade plans from <Link href="/billing" className="text-primary underline underline-offset-2">Billing</Link> after you connect an account.
        </p>
      </section>

      <section id="web-push" className="mt-12 scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold text-foreground">Web Push (browser notifications)</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          VAPID + RFC 8188 encrypted browser push, self-hosted and wire-compatible with Pusher Beams. Fetch the project
          public key from <code className="font-mono text-xs">GET /push/web/vapid-public-key</code> and register the
          browser's <code className="font-mono text-xs">PushSubscription</code> via{" "}
          <code className="font-mono text-xs">POST /push/web/subscribe</code>. No third-party push service required.
          Full protocol notes, SDK usage, and service worker snippet in{" "}
          <a
            href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/web-push-vapid.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            docs/web-push-vapid.md
          </a>
          .
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
        <Button asChild>
          <Link href={HOSTED_PATHS.signUp}>{HOSTED_COPY.startFree}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="https://github.com/AlessandroFare/fluxychat" target="_blank" rel="noopener noreferrer">
            View monorepo on GitHub
          </a>
        </Button>
      </div>
    </MarketingShell>
  );
}

