"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { persistActiveProjectToClerk } from "@/lib/persist-active-project";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { useDashboardSession } from "./dashboard-session";

/**
 * After Clerk sign-in: provision tenant project + mint admin JWT (hosted cloud).
 */
export function FluxyAutoConnect() {
  const { isSignedIn, isLoaded } = useUser();
  const { adminJwt, setAdminJwt, setActiveProject } = useDashboardSession();
  const ran = useRef(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isClerkClientConfigured() || !isLoaded || !isSignedIn || ran.current) return;
    if (adminJwt.trim().length >= 12) return;

    ran.current = true;
    setProvisionError(null);

    void (async () => {
      try {
        const sessionRes = await fetch("/api/fluxy/session");
        const session = (await sessionRes.json()) as {
          canAutoConnect?: boolean;
          hasProvisionedProject?: boolean;
        };

        if (!session.canAutoConnect) return;

        const res = await fetch("/api/fluxy/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            createProject: !session.hasProvisionedProject,
          }),
        });
        const json = (await res.json()) as {
          adminJwt?: string;
          activeProject?: { id: string; name: string; created_at: string; apiKey?: string };
          error?: string;
        };

        if (!res.ok) {
          setProvisionError(json.error || "Could not connect to Fluxychat Cloud");
          ran.current = false;
          return;
        }

        if (json.adminJwt) setAdminJwt(json.adminJwt);
        if (json.activeProject) {
          setActiveProject(json.activeProject);
          void persistActiveProjectToClerk(json.activeProject);
        }
      } catch {
        setProvisionError("Network error while connecting to Fluxychat Cloud");
        ran.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, adminJwt, setAdminJwt, setActiveProject]);

  if (!provisionError) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 shadow-lg"
      role="status"
    >
      <p className="font-medium">Cloud connect</p>
      <p className="mt-1">{provisionError}</p>
      <p className="mt-1 text-amber-800/90">Use Quickstart → Connect account, or check server env.</p>
    </div>
  );
}
