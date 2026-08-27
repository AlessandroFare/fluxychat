"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, MessageSquare, Terminal } from "lucide-react";
import { finishQuickstartAndOpenConsole } from "./onboarding-finish";
import { resolveQuickstartUserKey } from "@/lib/onboarding-user-key";
import { markQuickstartComplete } from "@/lib/quickstart-progress";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface FinishStepProps {
  wizard: OnboardingWizard;
}

export function FinishStep({ wizard: w }: FinishStepProps) {
  const [copied, setCopied] = useState(false);

  const installCommand = "npx @fluxy-chat/create-fluxy-chat@latest my-bot";

  // Mark complete as soon as the user reaches the final step — not only on "Go to Dashboard".
  useEffect(() => {
    const key = resolveQuickstartUserKey(w.clerkUser?.id, w.userId);
    if (key) markQuickstartComplete(key);
  }, [w.clerkUser?.id, w.userId]);

  function handleCopyCommand() {
    void navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenConsole() {
    const userKey = resolveQuickstartUserKey(w.clerkUser?.id, w.userId);
    if (!userKey) return;
    void finishQuickstartAndOpenConsole(w.router, {
      clerkUserId: userKey,
      memberJwt: w.memberJwt,
      memberUserId: w.userId.trim() || "alice",
      projectId: w.activeProject?.id ?? "",
      setLastRoom: w.setLastRoom,
    });
  }

  const summaryItems = [
    {
      label: "Project",
      value: w.project?.name ?? "—",
      done: Boolean(w.project?.id),
    },
    {
      label: "Member token",
      value: w.memberJwt ? `${w.memberJwt.slice(0, 24)}...` : "—",
      done: Boolean(w.memberJwt.trim()),
    },
    {
      label: "First message",
      value: w.userSentMessage ? "Sent successfully" : "Skipped",
      done: w.userSentMessage,
    },
  ];

  return (
    <div className="mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          You're all set!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything is configured and ready. Here's what was set up:
        </p>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  item.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
            <code className="text-xs text-muted-foreground">{item.value}</code>
          </div>
        ))}
      </div>

      {/* Install command */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          Install the CLI
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-[#0d1117] p-3">
          <code className="flex-1 font-mono text-xs text-[#e6edf3]">{installCommand}</code>
          <button
            type="button"
            onClick={handleCopyCommand}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#e6edf3] transition-colors hover:bg-white/10"
            title="Copy command"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        <button
          type="button"
          onClick={handleOpenConsole}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
        >
          Go to Dashboard
          <ExternalLink className="h-4 w-4" />
        </button>
        <Link
          href="/docs"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Explore Docs
        </Link>
        <Link
          href="https://discord.gg/fluxychat"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <MessageSquare className="h-4 w-4" />
          Join Discord
        </Link>
      </div>

      {w.error && <p className="text-center text-xs text-red-500">{w.error}</p>}
    </div>
  );
}
