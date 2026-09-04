"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui";
import { isPublicSitePath } from "@/lib/public-site-paths";

const COOKIE_CONSENT_KEY = "fluxychat_cookie_consent";

function isMarketingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return isPublicSitePath(pathname);
}

export function CookieConsentBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isMarketingPath(pathname)) {
      setShowBanner(false);
      return;
    }
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
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

  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[1000] flex flex-col items-start justify-between gap-3 border-t border-border bg-background px-4 py-4 shadow-[var(--shadow-subtle-3)] sm:flex-row sm:items-center sm:px-6"
    >
      <p className="text-sm text-muted-foreground">
        We use essential cookies for sign-in and session. No ad or third-party tracking.{" "}
        <Link href="/privacy" className="font-medium text-foreground underline-offset-2 hover:underline">
          Privacy & GDPR
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="primary" onClick={accept}>
          Accept
        </Button>
        <Button variant="ghost" onClick={reject}>
          Reject
        </Button>
      </div>
    </div>
  );
}
