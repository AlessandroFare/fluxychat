"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPublicSitePath } from "@/lib/public-site-paths";
import { cMono, cSans } from "../landing/c-fonts";
import styles from "../landing/landing-c.module.css";

const COOKIE_CONSENT_KEY = "fluxychat_cookie_consent";

export function CookieConsentBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!pathname || !isPublicSitePath(pathname)) return;
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    // Reading the consent store is an external-system sync, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowBanner(stored !== "accepted" && stored !== "rejected");
  }, [pathname]);

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShowBanner(false);
  }

  function reject() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    setShowBanner(false);
  }

  if (!showBanner || !pathname || !isPublicSitePath(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className={`${styles.chrome} ${pathname === "/" ? "" : styles.themeable} ${styles.cookieBanner} ${cSans.variable} ${cMono.variable}`}
    >
      <p>
        We use essential cookies for sign-in and session. No ad or third-party tracking.{" "}
        <Link href="/privacy-policy">Privacy &amp; GDPR</Link>
      </p>
      <div className={styles.cookieActions}>
        <button type="button" className={styles.cookieButton} onClick={reject}>
          Reject
        </button>
        <button
          type="button"
          className={`${styles.cookieButton} ${styles.cookieButtonPrimary}`}
          onClick={accept}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
