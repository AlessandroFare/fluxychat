"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import {
  isQuickstartComplete,
  loadQuickstartProgress,
} from "@/lib/quickstart-progress";
import { isConsoleRoute } from "./console-nav";
import { useDashboardSession } from "./dashboard-session";

/**
 * Hosted cloud routing:
 * - Incomplete quickstart → stay on /onboarding (console routes redirect there).
 * - Complete → / overview allowed; /onboarding redirects to / unless ?review=1.
 */
export function QuickstartGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const { hasHydrated, adminJwt, memberJwt, activeProject, lastRoom } = useDashboardSession();

  useEffect(() => {
    if (!isClerkClientConfigured() || !isLoaded || !isSignedIn || !hasHydrated) return;

    const session = {
      adminJwt,
      memberJwt,
      activeProjectId: activeProject?.id ?? null,
      lastRoomId: lastRoom?.id ?? null,
    };
    const progress = loadQuickstartProgress();
    const complete = isQuickstartComplete(session, progress);
    const review = searchParams.get("review") === "1";

    if (pathname.startsWith("/onboarding")) {
      if (complete && !review) {
        router.replace("/");
      }
      return;
    }

    if (isConsoleRoute(pathname) && !complete) {
      router.replace("/onboarding");
    }
  }, [
    pathname,
    router,
    searchParams,
    isLoaded,
    isSignedIn,
    hasHydrated,
    adminJwt,
    memberJwt,
    activeProject?.id,
    lastRoom?.id,
  ]);

  return <>{children}</>;
}
