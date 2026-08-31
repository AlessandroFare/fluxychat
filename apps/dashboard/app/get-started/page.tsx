import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { ArrowRight, Cloud, Code2, KeyRound, LayoutDashboard, Package } from "lucide-react";
import { Button } from "~/components/ui/button";
import { GetStartedAccessBanner } from "../components/get-started-access-banner";
import { GetStartedAuthCta } from "../components/get-started-auth-cta";
import { GetStartedSelfHostSection } from "../components/get-started-self-host";
import { MarketingShell } from "../components/marketing-shell";
import { QuickstartSdkSnippet } from "../components/quickstart-sdk-snippet";
import { HOSTED_COPY, HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";

export const metadata: Metadata = PAGE_METADATA.getStarted;

const HOSTED_STEPS = [
  {
    icon: Cloud,
    title: "Create your account",
    body: "Sign up on Fluxychat Cloud. We provision a project and API credentials. No Worker deploy on day one.",
  },
  {
    icon: Package,
    title: "Install the SDK or use the CLI",
    body: "Run pnpm add @fluxy-chat/react, or npx @fluxy-chat/create-fluxy-chat@latest. Public rooms: FluxyRealtimeProvider plus publishableKey (pk_). No token endpoint.",
  },
  {
    icon: Code2,
    title: "Send your first message",
    body: "Open two tabs. pk_ in the browser for public rooms. Production apps mint a member JWT with POST /auth/token and X-Fluxy-Api-Key (fc_ keys stay server-only).",
  },
  {
    icon: LayoutDashboard,
    title: "Open the console for ops",
    body: "Manage rooms, agents, MCP tools, quotas, and billing once you are signed in.",
  },
  {
    icon: KeyRound,
    title: "Upgrade when you need more",
    body: "Start on the free tier. Move to a paid plan in the console when quotas or AI agent invokes become a bottleneck.",
  },
] as const;

export default function GetStartedPage() {
  return (
    <MarketingShell>
      <GetStartedAccessBanner />

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quickstart</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">
        Get your first message live
      </h1>
      <p className="mt-3 text-muted-foreground">
        Account, SDK, first room on hosted cloud. Self-hosting is optional; see{" "}
        <a href="#self-host" className="font-medium text-primary underline-offset-2 hover:underline">
          advanced
        </a>
        . Positioning and tradeoffs:{" "}
        <Link href={HOSTED_PATHS.why} className="font-medium text-primary underline-offset-2 hover:underline">
          /why
        </Link>
        .
      </p>

      <QuickstartSdkSnippet />

      <section className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Chat only</p>
        <h2 className="mt-1 font-heading text-lg font-semibold text-foreground">
          Fastest path: minimal CLI or drop-in widget
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Scaffold a chat-only Vite app in one command. Public rooms:{" "}
          <code className="text-xs">publishableKey</code> on the provider, or{" "}
          <code className="text-xs">guest</code> on{" "}
          <code className="text-xs">FluxyChatWidget</code>. No card. Free hosted is
          beta. For headless control, use <code className="text-xs">useChat</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
          {`npx @fluxy-chat/create-fluxy-chat@latest my-chat --minimal\npnpm add @fluxy-chat/ui-kit`}
        </pre>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild size="sm">
            <Link href={HOSTED_PATHS.onboarding}>Open onboarding wizard</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={docsSiteHref("getting-started/chat-only-quickstart")}>Chat-only quickstart</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href="https://github.com/AlessandroFare/fluxychat/tree/main/packages/ui-kit#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              ui-kit README
            </a>
          </Button>
        </div>
      </section>

      <p className="mt-4 text-sm text-muted-foreground">
        Step-by-step afternoon guide in the repo:{" "}
        <a
          href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/quickstart-afternoon.md"
          className="font-medium text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          docs/quickstart-afternoon.md
        </a>
        .
      </p>

      <ol className="mt-10 space-y-6">
        {HOSTED_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-subtle-2)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <step.icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </p>
              <h2 className="font-heading text-lg font-semibold text-foreground">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <GetStartedAuthCta />
        <Button asChild variant="outline">
          <Link href={HOSTED_PATHS.docs}>{HOSTED_COPY.viewDocs}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={HOSTED_PATHS.landing}>
            Product overview
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <GetStartedSelfHostSection />
    </MarketingShell>
  );
}

