"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { persistActiveProjectToClerk } from "@/lib/persist-active-project";
import { useDashboardSession } from "./dashboard-session";

interface ConnectFluxyButtonProps {
  className?: string;
  redirectTo?: string;
  label?: string;
  /** Called after a successful connect (before optional redirect). */
  onConnected?: () => void;
  /** When true, do not navigate after connect. */
  skipRedirect?: boolean;
}

export function ConnectFluxyButton({
  className,
  redirectTo = "/onboarding",
  label = "Connect cloud account",
  onConnected,
  skipRedirect = false,
}: ConnectFluxyButtonProps) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { setAdminJwt, setMemberJwt, setActiveProject } = useDashboardSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) {
    return null;
  }

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const sessionRes = await fetch("/api/fluxy/session");
      const session = (await sessionRes.json()) as { hasProvisionedProject?: boolean };

      const res = await fetch("/api/fluxy/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createProject: !session.hasProvisionedProject,
        }),
      });
      const json = (await res.json()) as {
        adminJwt?: string;
        memberJwt?: string;
        activeProject?: { id: string; name: string; created_at: string; apiKey?: string };
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Connect failed");
        return;
      }
      if (json.adminJwt) {
        setAdminJwt(json.adminJwt);
      }
      if (json.memberJwt) {
        setMemberJwt(json.memberJwt);
      }
      if (json.activeProject) {
        setActiveProject(json.activeProject);
        void persistActiveProjectToClerk(json.activeProject);
      }
      onConnected?.();
      if (!skipRedirect) {
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" onClick={() => void connect()} disabled={busy}>
        {busy ? "Connecting…" : label}
      </Button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
