"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, MessageSquare, Terminal } from "lucide-react";
import { finishQuickstartAndOpenConsole } from "./onboarding-finish";
import { resolveQuickstartUserKey } from "@/lib/onboarding-user-key";
import { markQuickstartComplete } from "@/lib/quickstart-progress";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface FinishStepProps {
  wizard: OnboardingWizard;
}

function slugFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "my-first-project";
}

export function FinishStep({ wizard: w }: FinishStepProps) {
  const [copied, setCopied] = useState(false);
  const slug = slugFromName(w.project?.name || "my-first-project");
  const npxCommand = `npx @fluxy-chat/create-fluxy-chat@latest ${slug}`;
  const snippet = useMemo(
    () =>
      `import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

<FluxyRealtimeProvider workerUrl="${w.workerUrl}">
  <Chat />
</FluxyRealtimeProvider>

function Chat() {
  const { messages, sendMessage } = useChat({ roomId: "${w.room?.id || "general"}" });
  return null;
}`,
    [w.workerUrl, w.room?.id],
  );

  useEffect(() => {
    const key = resolveQuickstartUserKey(w.clerkUser?.id, w.userId);
    if (key) markQuickstartComplete(key);
  }, [w.clerkUser?.id, w.userId]);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Put it in your app</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          npx scaffolds a project. It does not install a global CLI. Paste the snippet into Next.js,
          Vite, or a script tag.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          Run in your project
        </div>
        <div
          data-tour="all-set"
          className="flex items-center gap-2 rounded-xl border border-border bg-[#0d1117] p-3"
        >
          <code className="flex-1 font-mono text-xs text-[#e6edf3]">{npxCommand}</code>
          <button
            type="button"
            onClick={() => copy(npxCommand)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#e6edf3]"
            title="Copy command"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Snippet (Worker URL already filled)</p>
        <pre className="max-h-48 overflow-auto rounded-xl border border-border bg-[#0d1117] p-3 font-mono text-[11px] text-[#e6edf3]">
          {snippet}
        </pre>
        <p className="text-xs text-muted-foreground">
          Waiting for your app to connect… that light turns green on the first WebSocket from this
          project (check the console after you run the scaffold).
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3" data-tour="explore-features">
        <Link href="/settings/agent-tools" className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
          Add an approval rule
        </Link>
        <Link href="/integrations" className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
          Connect Slack or Telegram
        </Link>
        <Link href="/rooms" className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
          Invite a teammate
        </Link>
      </div>

      <details className="rounded-lg border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">More modules</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Card builder, DevTools, voice pipeline, and collab live in the console after this tour.
        </p>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={handleOpenConsole}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-white"
        >
          Open console
          <ExternalLink className="h-4 w-4" />
        </button>
        <Link
          href="/docs"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium"
        >
          Docs
        </Link>
        <Link
          href="https://discord.gg/fluxychat"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-6 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          Discord
        </Link>
      </div>

      {w.error ? <p className="text-center text-xs text-red-500">{w.error}</p> : null}
    </div>
  );
}
