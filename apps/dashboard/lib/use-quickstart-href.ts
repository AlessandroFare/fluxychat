"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { HOSTED_PATHS, hostedQuickstartReviewHref, isClerkClientConfigured } from "@/lib/hosted-product";
import { isQuickstartComplete, loadQuickstartProgress } from "@/lib/quickstart-progress";
import { useDashboardSession } from "@/app/components/dashboard-session";

/** Wizard URL, or review mode when this Clerk user already finished quickstart. */
export function useQuickstartHref(): string {
  const { isSignedIn, user } = useUser();
  const { hasHydrated, clerkUserId, adminJwt, memberJwt, activeProject, lastRoom } =
    useDashboardSession();
  const [href, setHref] = useState<string>(HOSTED_PATHS.onboarding);

  useEffect(() => {
    if (!isClerkClientConfigured() || !isSignedIn || !user?.id || !hasHydrated || clerkUserId !== user.id) {
      setHref(HOSTED_PATHS.onboarding);
      return;
    }
    const complete = isQuickstartComplete(
      user.id,
      {
        adminJwt,
        memberJwt,
        activeProjectId: activeProject?.id ?? null,
        lastRoomId: lastRoom?.id ?? null,
      },
      loadQuickstartProgress(user.id),
    );
    setHref(complete ? hostedQuickstartReviewHref() : HOSTED_PATHS.onboarding);
  }, [
    isSignedIn,
    user?.id,
    hasHydrated,
    clerkUserId,
    adminJwt,
    memberJwt,
    activeProject?.id,
    lastRoom?.id,
  ]);

  return href;
}
