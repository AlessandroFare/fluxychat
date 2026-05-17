"use client";

import { useClerkUser } from "@/lib/clerk-user";
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
  const { isLoaded, isSignedIn, user } = useClerkUser();
  const { hasHydrated, clerkUserId, adminJwt, memberJwt, activeProject, lastRoom } = useDashboardSession();

  useEffect(() => {
    if (!isClerkClientConfigured() || !isLoaded || !isSignedIn || !hasHydrated) return;
    const activeClerkId = user?.id ?? null;
    if (!activeClerkId || clerkUserId !== activeClerkId) return;

    const session = {
      adminJwt,
      memberJwt,
      activeProjectId: activeProject?.id ?? null,
      lastRoomId: lastRoom?.id ?? null,
    };
    const progress = loadQuickstartProgress(activeClerkId);
    const complete = isQuickstartComplete(activeClerkId, session, progress);
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
    user?.id,
    clerkUserId,
    hasHydrated,
    adminJwt,
    memberJwt,
    activeProject?.id,
    lastRoom?.id,
  ]);

  return <>{children}</>;
}
