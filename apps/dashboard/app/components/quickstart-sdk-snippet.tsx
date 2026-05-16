"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { getPublicWorkerUrl, isPublicHostedCloud } from "@/lib/worker-url-client";

const INSTALL = "pnpm add @fluxy-chat/sdk";

export function QuickstartSdkSnippet() {
  const [workerUrl, setWorkerUrl] = useState(getPublicWorkerUrl());
  const [copied, setCopied] = useState<"install" | "env" | null>(null);

  useEffect(() => {
    void fetch("/api/fluxy/config")
      .then((r) => r.json())
      .then((json: { workerUrl?: string }) => {
        if (json.workerUrl) setWorkerUrl(json.workerUrl);
      })
      .catch(() => {
        // keep build-time public env fallback
      });
  }, []);

  const envLine = isPublicHostedCloud()
    ? `NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL=${workerUrl}`
    : `NEXT_PUBLIC_FLUXYCHAT_WORKER_URL=${workerUrl}`;

  async function copy(text: string, key: "install" | "env") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-8 space-y-3 rounded-2xl border border-black/[0.06] bg-[#111111] p-4 text-slate-100 shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">SDK quickstart</p>
      <div className="flex items-center gap-2 font-mono text-sm">
        <code className="min-w-0 flex-1 truncate">{INSTALL}</code>
        <button
          type="button"
          onClick={() => void copy(INSTALL, "install")}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
        >
          {copied === "install" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copy
        </button>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
        <code className="min-w-0 flex-1 break-all">{envLine}</code>
        <button
          type="button"
          onClick={() => void copy(envLine, "env")}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
        >
          {copied === "env" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copy
        </button>
      </div>
    </div>
  );
}
