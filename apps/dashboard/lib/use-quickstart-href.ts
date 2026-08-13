"use client";

import { useEffect, useState } from "react";
import { useClerkUser } from "@/lib/clerk-user";
import { HOSTED_PATHS, hostedQuickstartReviewHref, isClerkClientConfigured } from "@/lib/hosted-product";
import { isQuickstartComplete } from "@/lib/quickstart-progress";
import { resolveQuickstartUserKey } from "@/lib/onboarding-user-key";
import { useQuickstartProgress } from "@/lib/use-quickstart-progress";
import { useDashboardSession } from "@/app/components/dashboard-session";

/** Wizard URL, or review mode when this Clerk user already finished quickstart. */
export function useQuickstartHref(): string {
  const { isSignedIn, user } = useClerkUser();
  const { hasHydrated, clerkUserId, adminJwt, memberJwt, activeProject, lastRoom } =
    useDashboardSession();

  const userKey = resolveQuickstartUserKey(user?.id ?? clerkUserId, "");
  const progress = useQuickstartProgress(userKey);
  const [href, setHref] = useState<string>(HOSTED_PATHS.onboarding);

  useEffect(() => {
    if (!isClerkClientConfigured() || !isSignedIn || !userKey || !hasHydrated) {
      setHref(HOSTED_PATHS.onboarding);
      return;
    }
    if (clerkUserId && user?.id && clerkUserId !== user.id) {
      setHref(HOSTED_PATHS.onboarding);
      return;
    }
    const complete = isQuickstartComplete(
      userKey,
      {
        adminJwt,
        memberJwt,
        activeProjectId: activeProject?.id ?? null,
        lastRoomId: lastRoom?.id ?? null,
      },
      progress,
    );
    setHref(complete ? hostedQuickstartReviewHref() : HOSTED_PATHS.onboarding);
  }, [
    isSignedIn,
    user?.id,
    userKey,
    hasHydrated,
    clerkUserId,
    adminJwt,
    memberJwt,
    activeProject?.id,
    lastRoom?.id,
    progress,
  ]);

  return href;
}
