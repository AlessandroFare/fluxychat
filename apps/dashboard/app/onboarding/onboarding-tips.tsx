"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TipPopover } from "@/components/tips/tip-popover";
import {
  clearDismissedTips,
  dismissTip,
  loadDismissedTips,
} from "@/lib/onboarding-tips";

export const ONBOARDING_TOUR_TIPS = [
  {
    id: "create-project",
    wizardStep: 0,
    selector: '[data-tour="create-project"]',
    title: "Create Project",
    body: "Your project is an isolated namespace. Traffic, quotas and keys live here. The token is under Developer details if you need it; you can ignore it for now.",
  },
  {
    id: "first-chat",
    wizardStep: 1,
    selector: '[data-tour="first-chat"]',
    title: "First Chat",
    body: "Mention @assistant to trigger the agent. Tool calls and results stream into the same timeline as messages.",
  },
  {
    id: "explore-features",
    wizardStep: 2,
    selector: '[data-tour="explore-features"]',
    title: "Explore Features",
    body: "These modules are already in your console. Start with an approval rule for risky tools.",
  },
  {
    id: "all-set",
    wizardStep: 2,
    selector: '[data-tour="all-set"]',
    title: "All set",
    body: "Copy this command to put the same room in your own app.",
  },
] as const;

interface OnboardingTipsProps {
  activeStep: number;
  userId?: string;
}

export function OnboardingTips({ activeStep, userId }: OnboardingTipsProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [domTick, setDomTick] = useState(0);

  useEffect(() => {
    setDismissed(loadDismissedTips(userId));
    setReady(true);
  }, [userId]);

  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      setDomTick((t) => t + 1);
      n += 1;
      if (n >= 15) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [activeStep]);

  const active = useMemo(() => {
    if (!ready) return null;
    const forStep = ONBOARDING_TOUR_TIPS.filter(
      (tip) => tip.wizardStep === activeStep && !dismissed.includes(tip.id),
    );
    for (const tip of forStep) {
      if (typeof document !== "undefined" && document.querySelector(tip.selector)) return tip;
    }
    return null;
  }, [activeStep, dismissed, ready, domTick]);

  const handleNext = useCallback(() => {
    if (!active) return;
    setDismissed(dismissTip(active.id, userId));
  }, [active, userId]);

  const handleDismiss = useCallback(() => {
    if (!active) return;
    setDismissed(dismissTip(active.id, userId));
  }, [active, userId]);

  const handleReplay = useCallback(() => {
    clearDismissedTips(userId);
    setDismissed([]);
  }, [userId]);

  if (!active) return null;

  return (
    <TipPopover
      target={active.selector}
      title={active.title}
      body={active.body}
      stepIndex={ONBOARDING_TOUR_TIPS.findIndex((t) => t.id === active.id)}
      stepTotal={ONBOARDING_TOUR_TIPS.length}
      onNext={handleNext}
      onDismiss={handleDismiss}
      onReplay={handleReplay}
    />
  );
}
