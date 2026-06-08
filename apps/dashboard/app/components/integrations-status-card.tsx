"use client";

import Link from "next/link";
import { ExternalLink, Shield, Smartphone } from "lucide-react";
import {
  DEMO_TURNSTILE_SITE_KEY,
  isDemoTurnstileEnabled,
} from "@/components/demo-turnstile";
import { Panel } from "./ui";
import { cn } from "@/lib/utils";

interface StatusRowProps {
  label: string;
  ok: boolean;
  detail: string;
}

function StatusRow({ label, ok, detail }: StatusRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm font-medium", ok ? "text-brand" : "text-amber-600 dark:text-amber-400")}>
        {detail}
      </span>
    </div>
  );
}

export function IntegrationsStatusCard({ className }: { className?: string }) {
  const turnstileSite = isDemoTurnstileEnabled();

  return (
    <div className={cn("space-y-4", className)}>
      <Panel className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Public demo (Turnstile)</h3>
        </div>
        <StatusRow
          label="Dashboard site key"
          ok={turnstileSite}
          detail={turnstileSite ? "Configured" : "Not set"}
        />
        <StatusRow
          label="Worker secret"
          ok={false}
          detail="Set in Wrangler (not visible here)"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Set <code className="text-[10px]">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> on Vercel and{" "}
          <code className="text-[10px]">TURNSTILE_SECRET_KEY</code> on the Worker. Then{" "}
          <code className="text-[10px]">POST /demo/session</code> requires a Turnstile token.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/demo"
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            Open demo
          </Link>
          <a
            href="https://developers.cloudflare.com/turnstile/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-brand hover:underline"
          >
            Cloudflare docs
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
        {turnstileSite ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground break-all">
            Site key prefix: {DEMO_TURNSTILE_SITE_KEY.slice(0, 8)}…
          </p>
        ) : null}
      </Panel>

      <Panel className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-brand" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Offline SMS (Sent.dm)</h3>
        </div>
        <StatusRow label="Worker automation" ok={false} detail="Configure on Worker" />
        <p className="mt-3 text-xs text-muted-foreground">
          Enable <code className="text-[10px]">OFFLINE_SMS_ENABLED</code>,{" "}
          <code className="text-[10px]">SENT_DM_API_KEY</code>, and{" "}
          <code className="text-[10px]">SENT_DM_PROFILE_ID</code> on the Worker. Members opt in per
          room under Notifications or room chat.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/notifications"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            SMS preferences
          </Link>
          <Link
            href="/guides/offline-notify-in-app-plus-sms"
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            Integration guide
          </Link>
        </div>
      </Panel>
    </div>
  );
}
