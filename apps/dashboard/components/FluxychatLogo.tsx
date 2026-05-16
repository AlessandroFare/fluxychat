/**
 * Fluxychat logo — icon, mark, and logotype (pure SVG, no extra deps).
 *
 * @example
 * import { FluxychatIcon, FluxychatMark, FluxychatLogotype } from "@/components/FluxychatLogo";
 * <FluxychatLogotype size={32} />
 */

const DEFAULT_COLOR = "#FF6A1A";

interface LogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/** Transparent F mark — use on colored surfaces */
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
      <path d="M 95,75 L 415,75 L 258,245 L 95,245 C -5,245 -5,75 95,75 Z" fill={color} />
      <path d="M 95,262 L 315,262 L 215,395 L 95,395 C -5,395 -5,262 95,262 Z" fill={color} />
    </svg>
  );
}

/** Rounded-square app icon */
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

/** Icon + wordmark — navbar / sidebar */
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
