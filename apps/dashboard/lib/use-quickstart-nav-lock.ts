"use client";

import { useMemo } from "react";
import { useClerkUser } from "@/lib/clerk-user";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { isQuickstartComplete } from "@/lib/quickstart-progress";
import { resolveQuickstartUserKey } from "@/lib/onboarding-user-key";
import { useQuickstartProgress } from "@/lib/use-quickstart-progress";
import { useDashboardSession } from "@/app/components/dashboard-session";

/** True when hosted quickstart is incomplete — sidebar links should appear disabled. */
export function useQuickstartNavLock() {
  const { isLoaded, isSignedIn, user } = useClerkUser();
  const { hasHydrated, clerkUserId, adminJwt, memberJwt, activeProject, lastRoom } =
    useDashboardSession();

  const userKey = resolveQuickstartUserKey(user?.id ?? clerkUserId, "");
  const progress = useQuickstartProgress(userKey);

  return useMemo(() => {
    if (!isClerkClientConfigured()) {
      return { locked: false, onboardingHref: "/onboarding" as const };
    }
    if (!hasHydrated || !isLoaded || !isSignedIn || !userKey) {
      return { locked: false, onboardingHref: "/onboarding" as const };
    }
    const session = {
      adminJwt,
      memberJwt,
      activeProjectId: activeProject?.id ?? null,
      lastRoomId: lastRoom?.id ?? null,
    };
    const complete = isQuickstartComplete(userKey, session, progress);
    return { locked: !complete, onboardingHref: "/onboarding" as const };
  }, [
    hasHydrated,
    isLoaded,
    isSignedIn,
    userKey,
    adminJwt,
    memberJwt,
    activeProject?.id,
    lastRoom?.id,
    progress,
  ]);
}
