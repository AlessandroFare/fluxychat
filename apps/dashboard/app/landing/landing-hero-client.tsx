"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { MARKETING_HERO } from "@/lib/marketing-landing";
import { HeroCodeInboxDemo } from "~/components/marketing/hero-code-inbox-demo";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { LandingHeroAuthCta } from "../components/landing-auth-cta";
import { HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";
import { INSTALL_CMD } from "./landing-shared";

const Grainient = dynamic(
  () => import("~/components/marketing/grainient").then((m) => ({ default: m.Grainient })),
  { ssr: false },
);

export function LandingHeroClient() {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <section className="relative min-h-[min(92svh,880px)] overflow-x-hidden border-b border-border pt-16 pb-12 sm:pt-24 sm:pb-16 md:pb-24">
      <Grainient
        className="z-0"
        color1="#ebe4ff"
        color2="#faf8f5"
        color3="#fdeee6"
        grainAnimated
        grainAmount={0.13}
        grainScale={1.55}
        timeSpeed={0.1}
        warpSpeed={0.75}
        saturation={0.68}
        contrast={1.04}
        gamma={0.98}
        zoom={0.88}
        centerX={0}
        centerY={-0.06}
        blendAngle={18}
        blendSoftness={0.42}
      />

      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
        <div
          className="landing-hero-blob landing-hero-blob--b absolute"
          style={{
            top: "8%",
            left: "-8%",
            width: "clamp(200px, 42vw, 560px)",
            height: "clamp(200px, 38vw, 480px)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 55% 45%, rgba(196,181,253,0.42) 0%, rgba(226,221,253,0.22) 38%, transparent 72%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="landing-hero-blob landing-hero-blob--c absolute"
          style={{
            top: "12%",
            right: "-8%",
            width: "clamp(200px, 40vw, 520px)",
            height: "clamp(200px, 36vw, 440px)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 45% 50%, rgba(255,200,175,0.38) 0%, rgba(255,228,210,0.18) 42%, transparent 70%)",
            filter: "blur(38px)",
          }}
        />
        <div
          className="landing-hero-blob landing-hero-blob--a absolute"
          style={{
            bottom: "-18%",
            left: "-16%",
            width: "clamp(400px, 50vw, 640px)",
            height: "clamp(340px, 46vw, 580px)",
            borderRadius: "50%",
            background: [
              "radial-gradient(",
              "  circle at 42% 40%,",
              "  rgba(215,55,8,0.72) 0%,",
              "  rgba(235,90,25,0.48) 24%,",
              "  rgba(248,140,70,0.22) 48%,",
              "  transparent 74%",
              ")",
            ].join(""),
            filter: "blur(42px)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "-14%",
            right: "-12%",
            width: "clamp(340px, 44vw, 560px)",
            height: "clamp(300px, 40vw, 500px)",
            borderRadius: "50%",
            background: [
              "radial-gradient(",
              "  circle at 58% 42%,",
              "  rgba(139,92,246,0.28) 0%,",
              "  rgba(255,149,128,0.16) 36%,",
              "  transparent 70%",
              ")",
            ].join(""),
            filter: "blur(44px)",
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: [
            "radial-gradient(",
            "  ellipse 75% 55% at 50% 0%,",
            "  rgba(255,255,255,0.88) 0%,",
            "  rgba(255,255,255,0.40) 45%,",
            "  transparent 68%",
            ")",
          ].join(""),
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, transparent 100%)" }}
        aria-hidden
      />

      <div className="relative z-[2] mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Link
            href={isClerkClientConfigured() ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}
            className="am-focus mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[var(--shadow-subtle-2)] backdrop-blur-md transition hover:border-black/12 hover:bg-white/95 sm:text-sm"
          >
            <span className="shrink-0 rounded-md bg-[#111111] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              New
            </span>
            <span className="truncate text-left sm:text-center">
              Free hosted tier — SDK live in minutes →
            </span>
          </Link>

          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 sm:tracking-[0.22em]">
            {MARKETING_HERO.eyebrow}
          </p>

          <h1 className="font-heading flex flex-wrap items-baseline justify-center gap-x-[0.18em] gap-y-1 text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-[#111111] sm:text-6xl md:text-7xl">
            <span>{MARKETING_HERO.headlineLead}</span>
            <span className="am-text-gradient--hero am-text-gradient--hero-glow">
              {MARKETING_HERO.headlineAccent}
            </span>
            <span className="text-[#111111]">.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-balance text-lg text-slate-600 sm:text-xl">
            {MARKETING_HERO.subhead}
          </p>
          <p className="mt-3 max-w-2xl text-balance text-sm text-slate-500 sm:text-base">
            {MARKETING_HERO.platformNote}
          </p>
          <p className="mt-2 max-w-2xl text-balance text-sm text-slate-500 sm:text-base">
            Chat infrastructure inside your product, not a helpdesk.{" "}
            <Link href={HOSTED_PATHS.compare} className="font-medium text-slate-700 underline-offset-2 hover:underline">
              Compare vs Pusher/Ably
            </Link>
            {" · "}
            <Link href={HOSTED_PATHS.why} className="font-medium text-slate-700 underline-offset-2 hover:underline">
              Why we built it
            </Link>
            {" · "}
            <Link
              href={HOSTED_PATHS.guidesVercelRealtime}
              className="font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Vercel without Pusher
            </Link>
            {" · "}
            <Link
              href="/guides/in-app-chat-vs-support-desk"
              className="font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              Product chat vs support
            </Link>
            .
          </p>

          <div className="mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch">
            <div
              className={cn(
                "flex min-h-[52px] flex-1 items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-sm sm:text-base",
                "border-[#111]/80 bg-[#111111] text-slate-100 shadow-md",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">{INSTALL_CMD}</span>
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20 sm:text-sm"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <LandingHeroAuthCta />
          </div>

          <p className="mt-4 max-w-xl text-xs text-slate-500 sm:text-sm">
            Works with npm and yarn too — same package name{" "}
            <code className="rounded border border-black/[0.06] bg-white/85 px-1.5 py-0.5 font-mono text-slate-700">
              @fluxy-chat/sdk
            </code>
            .
          </p>
        </div>

        <SpotlightCard
          className="mx-auto mt-12 max-w-5xl border-black/[0.14] bg-white p-5 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(0,0,0,0.08)] sm:p-6 md:mt-14"
          spotlightColor="rgba(232, 69, 10, 0.2)"
        >
          <HeroCodeInboxDemo />
        </SpotlightCard>
      </div>
    </section>
  );
}

