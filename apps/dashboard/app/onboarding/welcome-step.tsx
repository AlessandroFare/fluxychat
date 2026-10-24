"use client";

import { Bot, FolderKanban, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { FluxychatMark } from "@/components/FluxychatLogo";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface WelcomeStepProps {
  wizard: OnboardingWizard;
}

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Agents with approvals",
    desc: "Risky tool calls wait in the same timeline as chat. You approve or reject before they run.",
  },
  {
    icon: FolderKanban,
    title: "One room for chat, docs and presence",
    desc: "Messages, a shared doc, and who is online share one Durable Object. Not a 14-channel helpdesk.",
  },
  {
    icon: Bot,
    title: "Open source on Cloudflare",
    desc: "MIT. Self-host on your account, or use the hosted beta. No card for the free plan.",
  },
] as const;

export function WelcomeStep({ wizard: w }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <FluxychatMark size={48} />
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Humans and agents in the same room
      </h1>
      <p className="mt-3 max-w-xl text-base text-muted-foreground">
        First you name a project. Then you watch an agent ask permission. Slack and Telegram
        bridges are optional, later. We do not sell WhatsApp.
      </p>

      <div className="mt-8 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
        {VALUE_PROPS.map((vp) => {
          const Icon = vp.icon;
          return (
            <div key={vp.title} className="rounded-xl border border-border bg-card p-4">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{vp.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vp.desc}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Curious first?{" "}
        <Link href="/demo" className="underline underline-offset-2">
          Try the demo room
        </Link>{" "}
        as a guest — no account needed.
      </p>

      {!w.clerkSignedIn && !w.adminJwt.trim() ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {isClerkClientConfigured() ? (
            <>Next step asks you to sign in. The console unlocks once Quickstart is done.</>
          ) : (
            <>
              No sign-in gate on this deployment.{" "}
              <Link href={HOSTED_PATHS.console} className="underline underline-offset-2">
                Skip ahead to the console
              </Link>
              .
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
