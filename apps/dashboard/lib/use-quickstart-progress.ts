"use client";

import { useCallback, useEffect, useState } from "react";
import { loadQuickstartProgress, type QuickstartProgress } from "@/lib/quickstart-progress";

/** Reactive quickstart progress for the active user key (updates on save + storage). */
export function useQuickstartProgress(userKey: string | null | undefined): QuickstartProgress {
  const read = useCallback(
    () => (userKey ? loadQuickstartProgress(userKey) : {}),
    [userKey],
  );
  const [progress, setProgress] = useState<QuickstartProgress>(() => read());

  useEffect(() => {
    setProgress(read());
  }, [read]);

  useEffect(() => {
    if (!userKey || typeof window === "undefined") return;

    function refresh(event?: Event) {
      const detail = (event as CustomEvent<{ clerkUserId?: string }> | undefined)?.detail;
      if (detail?.clerkUserId && detail.clerkUserId !== userKey) return;
      setProgress(read());
    }

    window.addEventListener("quickstart-progress-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("quickstart-progress-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userKey, read]);

  return progress;
}
