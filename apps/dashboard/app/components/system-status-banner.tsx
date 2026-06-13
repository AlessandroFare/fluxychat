"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDashboardSession } from "./dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { isConsoleRoute } from "./console-nav";
import { usePathname } from "next/navigation";

interface AlertsStats {
  openAlerts: number;
}

/** RD-6 — surface open operational alerts for the active project (admin JWT). */
export function SystemStatusBanner() {
  const pathname = usePathname();
  const { adminJwt } = useDashboardSession();
  const [openAlerts, setOpenAlerts] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const token = adminJwt.trim();
    if (!token || !isConsoleRoute(pathname)) {
      setOpenAlerts(0);
      return;
    }

    let cancelled = false;
    const base = getPublicWorkerUrl();

    void (async () => {
      try {
        const data = await fetchWorkerJson<AlertsStats>(`${base}/stats/alerts?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!cancelled) setOpenAlerts(Number(data.openAlerts || 0));
      } catch {
        if (!cancelled) setOpenAlerts(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adminJwt, pathname]);

  if (dismissed || openAlerts <= 0) return null;

  return (
    <div
      role="status"
      className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-950"
    >
      <span>
        {openAlerts} open operational alert{openAlerts === 1 ? "" : "s"} for this project.
      </span>{" "}
      <Link href="/analytics" className="font-medium underline underline-offset-2">
        View analytics
      </Link>{" "}
      <button
        type="button"
        className="underline underline-offset-2 hover:text-red-900"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}
