"use client";

import { createContext, useContext, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { isClerkClientConfigured } from "@/lib/hosted-product";

export interface ClerkUserSnapshot {
  /**
   * Minimal Clerk user projection. The dashboard only consumes `id` in most
   * places; the optional fields are surfaced so call sites that want to
   * display profile info (e.g. /settings) can read them without bypassing
   * the safe-bridge abstraction.
   */
  user:
    | {
        id: string;
        fullName?: string | null;
        username?: string | null;
        primaryEmailAddress?: { emailAddress: string } | null;
      }
    | null;
  isSignedIn: boolean;
  isLoaded: boolean;
}

const defaultSnapshot: ClerkUserSnapshot = {
  user: null,
  isSignedIn: false,
  isLoaded: true,
};

const ClerkUserContext = createContext<ClerkUserSnapshot>(defaultSnapshot);

function ClerkUserBridgeInner({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const value = useMemo<ClerkUserSnapshot>(
    () => ({
      user: user?.id
        ? {
            id: user.id,
            fullName: user.fullName ?? null,
            username: user.username ?? null,
            primaryEmailAddress: user.primaryEmailAddress
              ? { emailAddress: user.primaryEmailAddress.emailAddress }
              : null,
          }
        : null,
      isSignedIn: Boolean(isSignedIn),
      isLoaded: Boolean(isLoaded),
    }),
    [user?.id, user?.fullName, user?.username, user?.primaryEmailAddress, isSignedIn, isLoaded],
  );
  return <ClerkUserContext.Provider value={value}>{children}</ClerkUserContext.Provider>;
}

/** Safe Clerk user state for self-host / e2e (no ClerkProvider) and hosted cloud. */
export function ClerkUserBridge({ children }: { children: React.ReactNode }) {
  if (!isClerkClientConfigured()) {
    return <ClerkUserContext.Provider value={defaultSnapshot}>{children}</ClerkUserContext.Provider>;
  }
  return <ClerkUserBridgeInner>{children}</ClerkUserBridgeInner>;
}

export function useClerkUser(): ClerkUserSnapshot {
  return useContext(ClerkUserContext);
}
