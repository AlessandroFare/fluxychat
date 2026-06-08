"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const DEMO_TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export function isDemoTurnstileEnabled(): boolean {
  return DEMO_TURNSTILE_SITE_KEY.length > 0;
}

interface DemoTurnstileProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

export function DemoTurnstile({ onToken, onError }: DemoTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!DEMO_TURNSTILE_SITE_KEY || !containerRef.current) return;

    let cancelled = false;

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: DEMO_TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          setLoading(false);
          onToken(token);
        },
        "error-callback": () => {
          setLoading(false);
          onError?.();
        },
        "expired-callback": () => {
          onError?.();
        },
      });
      setLoading(false);
    }

    if (window.turnstile) {
      renderWidget();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector(`script[src^="${TURNSTILE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", renderWidget);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", renderWidget);
      };
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
    };
  }, [onToken, onError]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px]" />
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Verifying you are human…
        </p>
      ) : null}
    </div>
  );
}
