"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { MARKETING_HERO } from "@/lib/marketing-landing";
import { HeroCodeInboxDemo } from "~/components/marketing/hero-code-inbox-demo";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import BlurText from "~/components/BlurText";
import Magnet from "~/components/Magnet";
import { LandingHeroAuthCta } from "../components/landing-auth-cta";
import { HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { INSTALL_CMD } from "./landing-shared";

export function LandingHeroClient() {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <section className="relative min-h-dvh overflow-x-hidden border-b border-white/[0.06] pt-16 pb-12 sm:pt-24 sm:pb-16 md:pb-24">
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 38%, rgba(11,11,12,0.2) 0%, rgba(11,11,12,0.72) 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Link
            href={isClerkClientConfigured() ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}
            className="am-focus mkt-enter mkt-chip mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-[0_0_0_1px_rgba(255,106,26,0.18)] transition hover:border-[var(--mkt-brand)]/40 hover:bg-white/[0.07] sm:text-sm"
            style={{ ["--mkt-stagger" as string]: 0 }}
          >
            <span className="shrink-0 rounded-md bg-[var(--mkt-brand)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              New
            </span>
            <span className="truncate text-left sm:text-center">
              Free hosted tier. SDK live in minutes →
            </span>
          </Link>

          <p
            className="mkt-enter mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:tracking-[0.22em]"
            style={{ ["--mkt-stagger" as string]: 1 }}
          >
            {MARKETING_HERO.eyebrow}
          </p>

          <h1
            className="mkt-enter font-heading flex flex-wrap items-baseline justify-center gap-x-[0.18em] gap-y-1 text-balance text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl"
            style={{ ["--mkt-stagger" as string]: 2 }}
          >
            <span>{MARKETING_HERO.headlineLead}</span>
            <span className="am-text-gradient--hero am-text-gradient--hero-glow">
              {MARKETING_HERO.headlineAccent}
            </span>
            <span className="text-white">.</span>
          </h1>

          <div
            className="mkt-enter mt-5 max-w-2xl text-pretty text-lg text-zinc-300 sm:text-xl"
            style={{ ["--mkt-stagger" as string]: 3 }}
          >
            <BlurText
              text={MARKETING_HERO.subhead}
              delay={28}
              animateBy="words"
              direction="bottom"
              className="justify-center text-center text-lg text-zinc-300 sm:text-xl"
              stepDuration={0.22}
            />
          </div>

          <div
            className="mkt-enter mt-8 flex w-full max-w-2xl flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ ["--mkt-stagger" as string]: 4 }}
          >
            <Magnet padding={28} magnetStrength={5} wrapperClassName="inline-flex">
              <LandingHeroAuthCta />
            </Magnet>
            <div
              data-testid="install-chip"
              className="inline-flex h-[52px] items-center gap-2 rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <code className="font-mono text-slate-100">{INSTALL_CMD}</code>
              {copied ? (
                <span data-testid="copy-check" className="inline-flex items-center gap-1 text-green-400">
                  <Check className="h-3 w-3" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onCopy}
                  data-testid="copy-button"
                  className="inline-flex items-center gap-0.5 text-slate-400 transition-colors hover:text-white"
                  aria-label="Copy install command"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div
            className="mkt-enter mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-300"
            style={{ ["--mkt-stagger" as string]: 5 }}
          >
            <span>Self-host on Cloudflare</span>
            <span aria-hidden="true">·</span>
            <span>MIT licensed</span>
            <span aria-hidden="true">·</span>
            <span>npm &amp; pnpm</span>
          </div>
        </div>

        <div className="mkt-enter mx-auto mt-12 max-w-5xl md:mt-14" style={{ ["--mkt-stagger" as string]: 6 }}>
          <SpotlightCard
            className="mkt-panel border-white/15 bg-zinc-950/80 p-5 sm:p-6"
            spotlightColor="rgba(255, 106, 26, 0.28)"
          >
            <HeroCodeInboxDemo />
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
