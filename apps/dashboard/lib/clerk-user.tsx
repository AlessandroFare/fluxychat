"use client";

import { createContext, useContext, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { isClerkClientConfigured } from "@/lib/hosted-product";

export interface ClerkUserSnapshot {
  user: { id: string } | null;
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
      user: user?.id ? { id: user.id } : null,
      isSignedIn: Boolean(isSignedIn),
      isLoaded: Boolean(isLoaded),
    }),
    [user?.id, isSignedIn, isLoaded],
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
