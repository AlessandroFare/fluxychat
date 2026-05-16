"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { purgeLegacyUnscopedKeys, scopedStorageKey } from "@/lib/scoped-browser-storage";

export interface DashboardProject {
  id: string;
  name: string;
  created_at?: string;
  apiKey?: string;
  plan?: {
    planName: string;
    billingStatus: string;
    messageLimitMonthly: number;
    agentInvokeLimitMonthly: number;
    webhookDeliveryLimitMonthly: number;
    pricingVersion: string;
  } | null;
}

/** Last room used in quickstart / chat (persisted for onboarding progress). */
export interface DashboardRoomRef {
  id: string;
  type?: string;
  name?: string;
  created_at?: string;
}

interface StoredDashboardSession {
  adminJwt?: string;
  memberJwt?: string;
  activeProject?: DashboardProject | null;
  lastRoom?: DashboardRoomRef | null;
}

interface DashboardSessionValue {
  /** True after storage has been read for the active scope (client-only). */
  hasHydrated: boolean;
  /** Clerk user id when hosted cloud; null when signed out or self-host. */
  clerkUserId: string | null;
  adminJwt: string;
  memberJwt: string;
  activeProject: DashboardProject | null;
  lastRoom: DashboardRoomRef | null;
  setAdminJwt: (value: string) => void;
  setMemberJwt: (value: string) => void;
  setActiveProject: (value: DashboardProject | null) => void;
  setLastRoom: (value: DashboardRoomRef | null) => void;
  clearSession: () => void;
  /** Hosted: bind storage to Clerk user; clears state when user changes or signs out. */
  switchClerkUser: (clerkUserId: string | null) => void;
  authHeader: (token?: string | null) => HeadersInit | undefined;
}

const STORAGE_BASE = "fluxychat.dashboard.session.v1";
const LEGACY_STORAGE_KEYS = [STORAGE_BASE];

function storageKeyForScope(clerkUserId: string | null): string {
  if (clerkUserId) return scopedStorageKey(STORAGE_BASE, clerkUserId);
  return STORAGE_BASE;
}

function loadSessionForScope(clerkUserId: string | null): StoredDashboardSession | null {
  try {
    const key = storageKeyForScope(clerkUserId);
    const sessionRaw = window.sessionStorage.getItem(key);
    if (sessionRaw) return JSON.parse(sessionRaw) as StoredDashboardSession;
  } catch {
    // Ignore corrupted state
  }
  return null;
}

function saveSessionForScope(clerkUserId: string | null, data: StoredDashboardSession): void {
  const key = storageKeyForScope(clerkUserId);
  window.sessionStorage.setItem(key, JSON.stringify(data));
}

function removeSessionForScope(clerkUserId: string | null): void {
  try {
    window.sessionStorage.removeItem(storageKeyForScope(clerkUserId));
  } catch {
    // ignore
  }
}

const DashboardSessionContext = createContext<DashboardSessionValue | null>(null);

export function DashboardSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkHosted = isClerkClientConfigured();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [clerkUserId, setClerkUserId] = useState<string | null>(null);
  const [adminJwt, setAdminJwtState] = useState("");
  const [memberJwt, setMemberJwtState] = useState("");
  const [activeProject, setActiveProjectState] = useState<DashboardProject | null>(null);
  const [lastRoom, setLastRoomState] = useState<DashboardRoomRef | null>(null);
  const scopeRef = useRef<string | null>(null);

  const applyStoredSession = useCallback((stored: StoredDashboardSession | null) => {
    if (!stored) {
      setAdminJwtState("");
      setMemberJwtState("");
      setActiveProjectState(null);
      setLastRoomState(null);
      return;
    }
    setAdminJwtState(stored.adminJwt || "");
    setMemberJwtState(stored.memberJwt || "");
    setActiveProjectState(stored.activeProject || null);
    setLastRoomState(stored.lastRoom || null);
  }, []);

  const switchClerkUser = useCallback(
    (nextClerkUserId: string | null) => {
      purgeLegacyUnscopedKeys(LEGACY_STORAGE_KEYS);
      if (scopeRef.current === nextClerkUserId) return;

      scopeRef.current = nextClerkUserId;
      setClerkUserId(nextClerkUserId);

      if (nextClerkUserId) {
        applyStoredSession(loadSessionForScope(nextClerkUserId));
      } else {
        applyStoredSession(null);
      }
      setHasHydrated(true);
    },
    [applyStoredSession],
  );

  useEffect(() => {
    if (clerkHosted) return;
    scopeRef.current = null;
    setClerkUserId(null);
    applyStoredSession(loadSessionForScope(null));
    setHasHydrated(true);
  }, [applyStoredSession, clerkHosted]);

  useEffect(() => {
    if (!hasHydrated) return;
    saveSessionForScope(scopeRef.current, { adminJwt, memberJwt, activeProject, lastRoom });
  }, [activeProject, adminJwt, hasHydrated, lastRoom, memberJwt]);

  const value = useMemo<DashboardSessionValue>(
    () => ({
      hasHydrated,
      clerkUserId,
      adminJwt,
      memberJwt,
      activeProject,
      lastRoom,
      setAdminJwt: setAdminJwtState,
      setMemberJwt: setMemberJwtState,
      setActiveProject: setActiveProjectState,
      setLastRoom: setLastRoomState,
      switchClerkUser,
      clearSession() {
        setAdminJwtState("");
        setMemberJwtState("");
        setActiveProjectState(null);
        setLastRoomState(null);
        removeSessionForScope(scopeRef.current);
      },
      authHeader(token) {
        const selectedToken = token?.trim() || adminJwt.trim() || memberJwt.trim();
        return selectedToken ? { Authorization: `Bearer ${selectedToken}` } : undefined;
      },
    }),
    [
      activeProject,
      adminJwt,
      clerkUserId,
      hasHydrated,
      lastRoom,
      memberJwt,
      switchClerkUser,
    ],
  );

  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  const value = useContext(DashboardSessionContext);
  if (!value) {
    throw new Error("useDashboardSession must be used inside DashboardSessionProvider");
  }
  return value;
}

export type ConsoleSetupPhase = "no_jwt" | "jwt_only" | "ready";

export function getConsoleSetupPhase(
  adminJwt: string,
  activeProject: DashboardProject | null,
): ConsoleSetupPhase {
  if (!adminJwt.trim()) return "no_jwt";
  if (!activeProject?.id) return "jwt_only";
  return "ready";
}

export function useConsoleSetupPhase(): ConsoleSetupPhase {
  const { adminJwt, activeProject } = useDashboardSession();
  return getConsoleSetupPhase(adminJwt, activeProject);
}
