/** Shared pointer sample for marketing motion. No React state. */

export const landingPointer = {
  nx: 0.5,
  ny: 0.4,
};

export function attachLandingPointer(overlay: HTMLElement | null): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return () => {};

  function onMove(event: PointerEvent) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    landingPointer.nx = event.clientX / w;
    landingPointer.ny = event.clientY / h;
    if (!overlay) return;
    overlay.style.setProperty("--mkt-px", landingPointer.nx.toFixed(4));
    overlay.style.setProperty("--mkt-py", landingPointer.ny.toFixed(4));
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  return () => window.removeEventListener("pointermove", onMove);
}
