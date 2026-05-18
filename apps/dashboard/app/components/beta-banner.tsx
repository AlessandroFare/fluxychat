"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const forceBetaNotice =
  process.env.NEXT_PUBLIC_BETA_BANNER === "1" ||
  process.env.NEXT_PUBLIC_BETA_BANNER === "true";

interface HealthPayload {
  ok?: boolean;
  degraded?: boolean;
  paymentsEnabled?: boolean;
}

export function BetaBanner() {
  const pathname = usePathname();
  const [workerPaymentsDisabled, setWorkerPaymentsDisabled] = useState(false);
  const [workerUnreachable, setWorkerUnreachable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (forceBetaNotice) return;
    let cancelled = false;
    const base = getPublicWorkerUrl();
    void (async () => {
      try {
        const data = await fetchWorkerJson<HealthPayload>(`${base}/health`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (data.paymentsEnabled === false) {
          setWorkerPaymentsDisabled(true);
        }
      } catch {
        if (!cancelled) setWorkerUnreachable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide on slides page for clean presentation
  if (pathname === "/slides" || pathname?.startsWith("/slides/")) {
    return null;
  }

  const visible =
    !dismissed && (forceBetaNotice || workerPaymentsDisabled || workerUnreachable);
  if (!visible) return null;

  const message = workerUnreachable
    ? "Beta — cannot reach the chat API. Check worker URL / deployment."
    : workerPaymentsDisabled
      ? "Beta — billing upgrades are disabled on this host (payments not configured)."
      : "Beta build. Report issues to your operator channel.";

  return (
    <div
      role="region"
      aria-label="Beta notice"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
    >
      <span>{message}</span>{" "}
      <button
        type="button"
        className="underline underline-offset-2 hover:text-amber-900"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}
