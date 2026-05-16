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
import { HOSTED_COPY, HOSTED_PATHS } from "@/lib/hosted-product";

export const metadata: Metadata = PAGE_METADATA.getStarted;

const HOSTED_STEPS = [
  {
    icon: Cloud,
    title: "Create your account",
    body: "Sign up on Fluxychat Cloud. We provision a project and API credentials — no Worker deploy on day one.",
  },
  {
    icon: Package,
    title: "Install the SDK",
    body: "Run pnpm add @fluxychat/sdk in your app and set baseUrl to the hosted API URL from the console.",
  },
  {
    icon: Code2,
    title: "Send your first message",
    body: "Mint a member JWT on your backend (or use the wizard), join a room, and render chat with useChat.",
  },
  {
    icon: LayoutDashboard,
    title: "Open the console for ops",
    body: "Manage rooms, agents, quotas, and billing once you are signed in.",
  },
  {
    icon: KeyRound,
    title: "Upgrade when you need more",
    body: "Start on the free tier. Move to a paid plan in the console when quotas or agents become a bottleneck.",
  },
] as const;

export default function GetStartedPage() {
  return (
    <MarketingShell>
      <GetStartedAccessBanner />

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quickstart</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-900">
        Get your first message live
      </h1>
      <p className="mt-3 text-slate-600">
        Account, SDK, first room on hosted cloud. Self-hosting is optional — see{" "}
        <a href="#self-host" className="font-medium text-primary underline-offset-2 hover:underline">
          advanced
        </a>
        .
      </p>

      <QuickstartSdkSnippet />

      <ol className="mt-10 space-y-6">
        {HOSTED_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <step.icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step {index + 1}
              </p>
              <h2 className="font-heading text-lg font-semibold text-slate-900">{step.title}</h2>
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
