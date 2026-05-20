/**
 * Fluxychat Logo Component
 * Drop this file into your Next.js project (e.g. components/FluxychatLogo.tsx)
 *
 * Usage:
 *   import { FluxychatIcon, FluxychatMark, FluxychatLogotype } from "@/components/FluxychatLogo";
 *
 *   <FluxychatIcon size={40} />           — rounded-square app icon
 *   <FluxychatMark size={32} />           — transparent F mark only
 *   <FluxychatLogotype size={32} />       — icon + "fluxychat" wordmark
 *
 * Props:
 *   size      — pixel size (default 32)
 *   color     — fill color for the mark (default #FF6A1A)
 *   className — passed to the root element
 */

import type { SVGProps } from "react";

const DEFAULT_COLOR = "#FF6A1A";

interface LogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/* ─── Raw F paths (two-piece wing mark) ──────────────────────────────────── */

/** Transparent background — use on any colored surface */
export function FluxychatMark({ size = 32, color = DEFAULT_COLOR, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Fluxychat"
      role="img"
    >
      {/* Top wing */}
      <path d="M 95,75 L 415,75 L 258,245 L 95,245 C -5,245 -5,75 95,75 Z" fill={color} />
      {/* Bottom wing (middle arm) */}
      <path d="M 95,262 L 315,262 L 215,395 L 95,395 C -5,395 -5,262 95,262 Z" fill={color} />
    </svg>
  );
}

/** Rounded-square icon — use as app icon, favicon container, or navbar badge */
export function FluxychatIcon({ size = 32, color = DEFAULT_COLOR, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Fluxychat"
      role="img"
    >
      <rect width="500" height="500" rx="110" fill={color} />
      <path d="M 95,75 L 415,75 L 258,245 L 95,245 C -5,245 -5,75 95,75 Z" fill="white" />
      <path d="M 95,262 L 315,262 L 215,395 L 95,395 C -5,395 -5,262 95,262 Z" fill="white" />
    </svg>
  );
}

/** Icon + wordmark side by side — use in navbar / sidebar header */
export function FluxychatLogotype({ size = 32, color = DEFAULT_COLOR, className }: LogoProps) {
  const fontSize = size * 0.75;
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.35 }}
    >
      <FluxychatIcon size={size} color={color} />
      <span
        style={{
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: "inherit",
        }}
      >
        fluxychat
      </span>
    </span>
  );
}
