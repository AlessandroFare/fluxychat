"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { purgeLegacyQuickstartStorage } from "@/lib/quickstart-progress";
import { useDashboardSession } from "./dashboard-session";

/**
 * Loads / clears dashboard session storage when the Clerk user changes.
 * Prevents JWTs and project data from leaking across accounts in the same browser.
 */
export function ClerkSessionBinder() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { switchClerkUser } = useDashboardSession();

  useEffect(() => {
    if (!isClerkClientConfigured() || !isLoaded) return;
    purgeLegacyQuickstartStorage();
    const clerkUserId = isSignedIn && user?.id ? user.id : null;
    switchClerkUser(clerkUserId);
  }, [isLoaded, isSignedIn, switchClerkUser, user?.id]);

  return null;
}
