"use client";

import { useEffect } from "react";
import { useClerkUser } from "@/lib/clerk-user";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { isQuickstartComplete } from "@/lib/quickstart-progress";
import { resolveQuickstartUserKey } from "@/lib/onboarding-user-key";
import { useQuickstartProgress } from "@/lib/use-quickstart-progress";
import { isConsoleRoute } from "./console-nav";
import { useDashboardSession } from "./dashboard-session";

/**
 * Hosted cloud routing:
 * - Incomplete quickstart → stay on /onboarding (console routes redirect there).
 * - Complete → /dashboard overview allowed; /onboarding redirects there unless ?review=1.
 */
export function QuickstartGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useClerkUser();
  const { hasHydrated, clerkUserId, adminJwt, memberJwt, activeProject, lastRoom } = useDashboardSession();

  const userKey = resolveQuickstartUserKey(user?.id ?? clerkUserId, "");
  const progress = useQuickstartProgress(userKey);

  useEffect(() => {
    if (!isClerkClientConfigured() || !isLoaded || !isSignedIn || !hasHydrated || !userKey) return;
    if (clerkUserId && user?.id && clerkUserId !== user.id) return;

    const session = {
      adminJwt,
      memberJwt,
      activeProjectId: activeProject?.id ?? null,
      lastRoomId: lastRoom?.id ?? null,
    };
    const complete = isQuickstartComplete(userKey, session, progress);
    const review = searchParams.get("review") === "1";

    if (pathname.startsWith("/onboarding")) {
      // Only leave the wizard after the finish step. firstMessageSent must
      // not bounce suggested-prompt clicks to /dashboard overview.
      if (progress.completedAt && !review) {
        router.replace(HOSTED_PATHS.console);
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
    userKey,
    progress,
  ]);

  return <>{children}</>;
}
