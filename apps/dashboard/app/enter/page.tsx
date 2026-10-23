"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Shield } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SkeletonCard } from "../components/ui";
import { ConsoleShell } from "../components/console-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";

function EnterConsoleBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const n = searchParams.get("next");
    if (!n || !n.startsWith("/") || n.startsWith("//")) return "/onboarding";
    return n;
  }, [searchParams]);

  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge(withSecret?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/console-ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withSecret ? { secret: withSecret } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell className="max-w-2xl lg:max-w-2xl">
      <div className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-[var(--ring)]" aria-hidden />
        Operator console
      </div>
      <h1 className="font-heading mb-3 text-[clamp(2.4rem,5vw,3.2rem)] font-normal leading-[1.02] tracking-[-0.035em] text-foreground">
        Before you open the console
      </h1>
      <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
        <p>
          This dashboard calls <strong className="text-foreground">your</strong> Worker URL (for example{" "}
          <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_FLUXYCHAT_WORKER_URL</code>
          ). Messages, agents, and webhooks count against <strong className="text-foreground">your</strong> quotas, not a shared sandbox.
        </p>
        <p>
          Anyone with the link can load the UI, but spend only happens when requests hit your Worker with valid JWTs and keys. Use staging
          credentials and low quotas while you test.
        </p>
      </div>

      <div className="mt-8 rounded-sm border border-border bg-card p-6">
        <p className="mb-4 text-sm font-medium text-foreground">Continue only if you deploy and run this stack.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="lg"
            className="gap-2"
            disabled={busy}
            onClick={() => void acknowledge()}
          >
            {busy ? "Opening…" : "Continue to console"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="lg" asChild>
            <Link href={HOSTED_PATHS.landing}>Back to product page</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          If <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs">CONSOLE_GATE_SECRET</code> is set on the server, enter it below. The main button returns 401 until the
          code matches.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="gate-secret" className="mb-1 block text-xs font-medium text-muted-foreground">
              Optional access code
            </label>
            <Input
              id="gate-secret"
              type="password"
              autoComplete="off"
              placeholder="Only if CONSOLE_GATE_SECRET is set on the server"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" disabled={busy || !secret.trim()} onClick={() => void acknowledge(secret.trim())}>
            Unlock with code
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </ConsoleShell>
  );
}

export default function EnterConsolePage() {
  return (
    <Suspense
      fallback={
        <ConsoleShell className="max-w-2xl lg:max-w-2xl">
          <SkeletonCard />
        </ConsoleShell>
      }
    >
      <EnterConsoleBody />
    </Suspense>
  );
}
