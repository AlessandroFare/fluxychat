"use client";

import { Bot, ChevronRight, Cloud, Plug } from "lucide-react";
import Link from "next/link";
import AnimatedContent from "@/components/AnimatedContent";
import BlurText from "@/components/BlurText";
import GlareHover from "@/components/GlareHover";
import Magnet from "@/components/Magnet";
import ShinyText from "@/components/ShinyText";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { FluxychatMark } from "@/components/FluxychatLogo";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface WelcomeStepProps {
  wizard: OnboardingWizard;
}

const VALUE_PROPS = [
  {
    icon: Plug,
    title: "Connect 14+ platforms",
    desc: "Slack, Discord, Telegram, WhatsApp, and more in one unified inbox.",
    glareHex: "#06B6D4",
  },
  {
    icon: Bot,
    title: "AI agents with tools",
    desc: "Streaming, tool calling, and human-in-the-loop approval built in.",
    glareHex: "#8B5CF6",
  },
  {
    icon: Cloud,
    title: "Deploy on Cloudflare",
    desc: "Edge-first architecture with D1, R2, and KV for sub-50ms responses.",
    glareHex: "#E8450D",
  },
] as const;

export function WelcomeStep({ wizard: w }: WelcomeStepProps) {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(386% 163% at -13% -17%, rgba(232,64,13,0.12) 0%, rgba(255,238,216,0.5) 26%, rgba(208,178,255,0.3) 84%), radial-gradient(80% 109% at 52% 63%, rgba(208,178,255,0.2) 0%, rgba(198,236,233,0.3) 35%, rgba(153,255,249,0.15) 97%)",
        }}
        aria-hidden
      />

      <div className="flex flex-col items-center px-4 text-center">
        <AnimatedContent distance={30} duration={0.6} threshold={0.01}>
          <div className="mb-6">
            <FluxychatMark size={56} />
          </div>
        </AnimatedContent>

        <BlurText
          text="Welcome to FluxyChat"
          className="justify-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          delay={50}
          animateBy="words"
        />

        <AnimatedContent distance={20} duration={0.5} delay={0.2} threshold={0.01} className="mt-3">
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            <ShinyText
              text="AI-native chat that runs on your edge"
              speed={2.5}
              color="hsl(var(--muted-foreground))"
              shineColor="hsl(var(--primary))"
            />
          </p>
        </AnimatedContent>

        <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {VALUE_PROPS.map((vp, i) => {
            const Icon = vp.icon;
            return (
              <AnimatedContent
                key={vp.title}
                distance={50}
                duration={0.65}
                delay={0.15 + i * 0.1}
                threshold={0.01}
                className="w-full"
              >
                <Magnet magnetStrength={5} padding={60} wrapperClassName="block w-full">
                  <GlareHover
                    width="100%"
                    height="auto"
                    background="rgba(255,255,255,0.85)"
                    borderRadius="1rem"
                    borderColor="hsl(var(--border))"
                    glareColor={vp.glareHex}
                    glareOpacity={0.4}
                    glareSize={200}
                    className="w-full backdrop-blur-sm"
                    style={{ minHeight: "9rem" }}
                  >
                    <div className="relative z-10 p-5 text-left">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{vp.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vp.desc}</p>
                    </div>
                  </GlareHover>
                </Magnet>
              </AnimatedContent>
            );
          })}
        </div>

        <AnimatedContent distance={24} duration={0.5} delay={0.55} threshold={0.01} className="mt-10">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => w.goNext()}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            >
              Get Started
              <ChevronRight className="h-4 w-4" />
            </button>
            <Link
              href={HOSTED_PATHS.console}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Skip tour
            </Link>
          </div>
        </AnimatedContent>

        {!w.clerkSignedIn && !w.adminJwt.trim() ? (
          <p className="mt-6 text-xs text-muted-foreground/70">
            You will connect your account in the next step
          </p>
        ) : null}
      </div>
    </div>
  );
}
