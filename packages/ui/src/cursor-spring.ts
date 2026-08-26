export interface SpringState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export const DEFAULT_CURSOR_SPRING: SpringConfig = {
  stiffness: 280,
  damping: 28,
  mass: 1,
};

/** One damped-spring step toward a target. `dtSeconds` is clamped to 32ms. */
export function stepSpring(
  state: SpringState,
  targetX: number,
  targetY: number,
  dtSeconds: number,
  config: SpringConfig = DEFAULT_CURSOR_SPRING,
): SpringState {
  const dt = Math.min(Math.max(dtSeconds, 0), 0.032);
  const { stiffness, damping, mass } = config;
  const ax = (-stiffness * (state.x - targetX) - damping * state.vx) / mass;
  const ay = (-stiffness * (state.y - targetY) - damping * state.vy) / mass;
  const vx = state.vx + ax * dt;
  const vy = state.vy + ay * dt;
  return {
    x: state.x + vx * dt,
    y: state.y + vy * dt,
    vx,
    vy,
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
