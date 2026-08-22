"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { MARKETING_HERO } from "@/lib/marketing-landing";
import { HeroCodeInboxDemo } from "~/components/marketing/hero-code-inbox-demo";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { HeroSignalField } from "~/components/marketing/hero-signal-field";
import BlurText from "~/components/BlurText";
import Magnet from "~/components/Magnet";
import { LandingHeroAuthCta } from "../components/landing-auth-cta";
import { useTheme } from "../components/theme-provider";
import { HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { INSTALL_CMD } from "./landing-shared";

export function LandingHeroClient() {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme !== "dark";

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <section className="relative min-h-dvh overflow-hidden border-b border-[var(--mkt-border)] pt-16 pb-12 sm:pt-24 sm:pb-16 md:pb-24">
      {isLight ? <HeroSignalField placement="hero" /> : null}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_18%,color-mix(in_srgb,var(--mkt-bg)_22%,transparent)_0%,transparent_72%)]"
        aria-hidden
      />

      <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Link
            href={isClerkClientConfigured() ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}
            className="am-focus mkt-enter mkt-chip mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--mkt-text)] shadow-[0_0_0_1px_rgba(24,24,27,0.08)] transition hover:border-[var(--mkt-brand)]/40 hover:bg-black/[0.04] sm:text-sm"
            style={{ ["--mkt-stagger" as string]: 0 }}
          >
            <span className="shrink-0 rounded-md bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-[var(--mkt-brand)]">
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
            className="mkt-enter font-heading flex flex-wrap items-baseline justify-center gap-x-[0.18em] gap-y-1 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-[var(--mkt-text)] sm:text-6xl md:text-7xl"
            style={{ ["--mkt-stagger" as string]: 2 }}
          >
            <span>{MARKETING_HERO.headlineLead}</span>
            <span className="am-text-gradient--hero am-text-gradient--hero-glow">
              {MARKETING_HERO.headlineAccent}
            </span>
            <span className="text-[var(--mkt-text)]">.</span>
          </h1>

          <div
            className="mkt-enter mt-5 max-w-2xl text-pretty text-lg text-[var(--mkt-text-muted)] sm:text-xl"
            style={{ ["--mkt-stagger" as string]: 3 }}
          >
            <BlurText
              text={MARKETING_HERO.subhead}
              delay={28}
              animateBy="words"
              direction="bottom"
              className="justify-center text-center text-lg text-[var(--mkt-text-muted)] sm:text-xl"
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
            className="mkt-enter mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--mkt-text-muted)]"
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
            className="border-[var(--mkt-border)] bg-[color-mix(in_srgb,var(--mkt-surface)_42%,transparent)] p-5 sm:p-6 backdrop-blur-[8px]"
            spotlightColor="rgba(255, 106, 26, 0.28)"
          >
            <HeroCodeInboxDemo />
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
