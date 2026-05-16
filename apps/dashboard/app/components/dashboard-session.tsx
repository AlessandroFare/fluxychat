"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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

interface DashboardSessionValue {
  adminJwt: string;
  memberJwt: string;
  activeProject: DashboardProject | null;
  setAdminJwt: (value: string) => void;
  setMemberJwt: (value: string) => void;
  setActiveProject: (value: DashboardProject | null) => void;
  clearSession: () => void;
  authHeader: (token?: string | null) => HeadersInit | undefined;
}

const STORAGE_KEY = "fluxychat.dashboard.session.v1";

// Migrate from localStorage to sessionStorage for better security:
// sessionStorage is cleared when the browser tab closes, reducing the window
// for token theft via XSS. We also attempt a one-time migration of any
// existing localStorage data to sessionStorage and then remove it.
function loadSession(): { adminJwt?: string; memberJwt?: string; activeProject?: DashboardProject | null } | null {
  try {
    // Prefer sessionStorage
    const sessionRaw = window.sessionStorage.getItem(STORAGE_KEY);
    if (sessionRaw) {
      return JSON.parse(sessionRaw);
    }
    // One-time migration from localStorage → sessionStorage
    const localRaw = window.localStorage.getItem(STORAGE_KEY);
    if (localRaw) {
      window.sessionStorage.setItem(STORAGE_KEY, localRaw);
      window.localStorage.removeItem(STORAGE_KEY);
      return JSON.parse(localRaw);
    }
  } catch {
    // Ignore corrupted state
  }
  return null;
}

const DashboardSessionContext = createContext<DashboardSessionValue | null>(null);

export function DashboardSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [adminJwt, setAdminJwtState] = useState("");
  const [memberJwt, setMemberJwtState] = useState("");
  const [activeProject, setActiveProjectState] = useState<DashboardProject | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (!stored) return;
    setAdminJwtState(stored.adminJwt || "");
    setMemberJwtState(stored.memberJwt || "");
    setActiveProjectState(stored.activeProject || null);
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ adminJwt, memberJwt, activeProject })
    );
  }, [activeProject, adminJwt, memberJwt]);

  const value = useMemo<DashboardSessionValue>(
    () => ({
      adminJwt,
      memberJwt,
      activeProject,
      setAdminJwt: setAdminJwtState,
      setMemberJwt: setMemberJwtState,
      setActiveProject: setActiveProjectState,
      clearSession() {
        setAdminJwtState("");
        setMemberJwtState("");
        setActiveProjectState(null);
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      },
      authHeader(token) {
        const selectedToken = token?.trim() || adminJwt.trim() || memberJwt.trim();
        return selectedToken ? { Authorization: `Bearer ${selectedToken}` } : undefined;
      },
    }),
    [activeProject, adminJwt, memberJwt]
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
