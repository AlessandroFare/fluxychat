"use client";

import { useEffect, useRef } from "react";
import styles from "./landing-c.module.css";

/**
 * The C pointer is an enhancement: native cursor stays until the first move.
 * Render a second instance inside a native <dialog> so the pointer survives the
 * browser's top layer; only the page instance hides the native cursor.
 */
export function LandingCursor({ hideNative = false }: { hideNative?: boolean }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine || !dot || !ring) return;

    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    let raf = 0;
    let shown = false;

    const paint = () => {
      raf = 0;
      const k = reduced ? 1 : 0.2;
      rx += (x - rx) * k;
      ry += (y - ry) * k;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      if (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1) {
        raf = requestAnimationFrame(paint);
      }
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      x = event.clientX;
      y = event.clientY;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      if (!shown) {
        shown = true;
        if (hideNative) document.documentElement.classList.add("fx-cursor");
        dot.classList.add(styles.cursorOn);
        ring.classList.add(styles.cursorOn);
      }
      const interactive =
        event.target instanceof Element
          ? event.target.closest("a, button, summary, [data-cursor]")
          : null;
      dot.classList.toggle(styles.cursorLink, Boolean(interactive));
      ring.classList.toggle(styles.cursorLink, Boolean(interactive));
      if (!raf) raf = requestAnimationFrame(paint);
    };

    const down = () => {
      dot.classList.add(styles.cursorDown);
      ring.classList.add(styles.cursorDown);
    };
    const up = () => {
      dot.classList.remove(styles.cursorDown);
      ring.classList.remove(styles.cursorDown);
    };
    const leave = () => {
      shown = false;
      dot.classList.remove(styles.cursorOn);
      ring.classList.remove(styles.cursorOn);
    };

    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", up, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);

    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
      if (hideNative) document.documentElement.classList.remove("fx-cursor");
    };
  }, [hideNative]);

  return (
    <>
      <div ref={ringRef} className={styles.cursorRing} aria-hidden="true" />
      <div ref={dotRef} className={styles.cursorDot} aria-hidden="true" />
    </>
  );
}
