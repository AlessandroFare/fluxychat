"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { PRODUCT_BETA_BANNER, PRODUCT_GITHUB_ISSUES } from "@/lib/product-facts";
import { cMono, cSans } from "../landing/c-fonts";
import styles from "../landing/landing-c.module.css";

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
  const landing = pathname === "/";
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

  const visible =
    !dismissed && (forceBetaNotice || workerPaymentsDisabled || workerUnreachable);
  if (!visible) return null;

  const message = workerUnreachable
    ? "Beta: cannot reach the chat API. Check worker URL / deployment."
    : workerPaymentsDisabled
      ? "Beta: billing upgrades are disabled on this host (payments not configured)."
      : PRODUCT_BETA_BANNER;

  return (
    <div
      // role="status"  assistive tech announces this when content
      // changes. We avoid `role="region"` so the banner doesn't
      // become a landmark inside the root layout's <main> (axe
      // `region` rule would flag it as content not in a landmark).
      role="status"
      className={`${styles.chrome} ${landing ? "" : styles.themeable} ${styles.betaBanner} ${cSans.variable} ${cMono.variable}`}
    >
      <span>{message}</span>{" "}
      {message === PRODUCT_BETA_BANNER ? (
        <>
          <a href={PRODUCT_GITHUB_ISSUES}>GitHub</a>{" "}
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}

