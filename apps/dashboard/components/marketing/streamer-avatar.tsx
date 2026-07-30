"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Animated host avatar for landing stream previews (headset, blink, talk). */
export function MarketingStreamerAvatar({ speaking = true }: { speaking?: boolean }) {
  const [blink, setBlink] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        window.setTimeout(() => {
          if (!cancelled) setBlink(false);
        }, 120);
        schedule();
      }, 2400 + Math.random() * 2200);
    };
    schedule();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span
      className={cn(
        "block h-full w-full transition-transform duration-300 ease-out motion-reduce:!transform-none",
        speaking && "scale-[1.035]",
      )}
      style={{ animation: "rt-avatar-sway 4.8s ease-in-out infinite" }}
    >
      <svg viewBox="0 0 120 142" className="h-full w-full overflow-visible motion-reduce:[&_*]:!animate-none" aria-hidden>
        <defs>
          <radialGradient id="rt-avatar-skin" cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#ffd2a6" />
            <stop offset="55%" stopColor="#f0b98a" />
            <stop offset="100%" stopColor="#d99a68" />
          </radialGradient>
          <linearGradient id="rt-avatar-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c3b8a" />
            <stop offset="100%" stopColor="#2c2160" />
          </linearGradient>
          <linearGradient id="rt-avatar-shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b7ce6" />
            <stop offset="100%" stopColor="#5b4bc4" />
          </linearGradient>
        </defs>

        <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animation: "rt-avatar-breathe 3.6s ease-in-out infinite" }}>
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144 Z" fill="url(#rt-avatar-shirt)" />
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144" fill="none" stroke="#3c2f8f" strokeWidth="1" opacity="0.4" />
          <path d="M20 46 Q60 5 100 46" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="20" cy="49" r="4.5" fill="#1e1b4b" />
          <circle cx="100" cy="49" r="4.5" fill="#1e1b4b" />
          <path d="M100 49 Q109 60 78 67" fill="none" stroke="#1e1b4b" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="78" cy="67" r="3.2" fill="#1e1b4b" />
        </g>

        <rect x="49" y="70" width="22" height="26" rx="8" fill="#e3a476" />
        <rect x="49" y="80" width="22" height="12" rx="6" fill="#d4915f" opacity="0.45" />
        <ellipse cx="60" cy="52" rx="35" ry="36" fill="url(#rt-avatar-skin)" />
        <ellipse cx="24" cy="53" rx="5" ry="7" fill="#eab787" />
        <ellipse cx="96" cy="53" rx="5" ry="7" fill="#eab787" />
        <path d="M23 48 Q20 8 60 8 Q100 8 97 48 Q97 22 60 20 Q23 22 23 48 Z" fill="url(#rt-avatar-hair)" />
        <path d="M23 46 Q60 -2 97 46" fill="none" stroke="#211a4a" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M40 40 Q47 36 54 39"
          fill="none"
          stroke="#241b13"
          strokeWidth="2.3"
          strokeLinecap="round"
          style={{ transition: "transform 200ms ease-out", transformBox: "fill-box", transformOrigin: "center", transform: speaking ? "translateY(-1.4px)" : "translateY(0)" }}
        />
        <path
          d="M66 39 Q73 36 80 40"
          fill="none"
          stroke="#241b13"
          strokeWidth="2.3"
          strokeLinecap="round"
          style={{ transition: "transform 200ms ease-out", transformBox: "fill-box", transformOrigin: "center", transform: speaking ? "translateY(-1.4px)" : "translateY(0)" }}
        />
        <ellipse cx="48" cy="50" rx="3.5" ry={blink ? 0.5 : 3.5} fill="#241b13" style={{ transition: "ry 90ms ease-out" }} />
        <ellipse cx="72" cy="50" rx="3.5" ry={blink ? 0.5 : 3.5} fill="#241b13" style={{ transition: "ry 90ms ease-out" }} />
        <circle cx="49.1" cy="48.6" r="0.9" fill="#fff" opacity={blink ? 0 : 0.85} />
        <circle cx="73.1" cy="48.6" r="0.9" fill="#fff" opacity={blink ? 0 : 0.85} />
        <path d="M60 50 Q58 58 60 60.5 Q62 59.5 61 56.5" fill="none" stroke="#d4915f" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="40" cy="62" rx="6" ry="3.2" fill="#f0916a" opacity="0.18" />
        <ellipse cx="80" cy="62" rx="6" ry="3.2" fill="#f0916a" opacity="0.18" />
        <ellipse
          cx="60"
          cy="67"
          rx="9.5"
          ry="6"
          fill="#8a3f2f"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            transform: speaking ? undefined : "scaleY(0.26)",
            animation: speaking ? "rt-avatar-talk 0.32s ease-in-out infinite" : undefined,
          }}
        />
        <path d="M50.5 67 Q60 71 69.5 67" fill="none" stroke="#5c2418" strokeWidth="0.8" opacity={speaking ? 0 : 1} />
      </svg>

      <style>{`
        @keyframes rt-avatar-talk {
          0%, 100% { transform: scaleY(0.26); }
          50% { transform: scaleY(1); }
        }
        @keyframes rt-avatar-sway {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(1deg) translateY(-1px); }
        }
        @keyframes rt-avatar-breathe {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.015); }
        }
      `}</style>
    </span>
  );
}
