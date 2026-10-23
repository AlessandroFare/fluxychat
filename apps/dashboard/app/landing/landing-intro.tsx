"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FluxychatMark } from "@/components/FluxychatLogo";
import styles from "./landing-c.module.css";

// Per JS context: a full reload replays the curtain, a client-side return skips it.
let hasPlayed = false;

/**
 * Landing-only curtain, once per document load. CSS runs the animation; the
 * effect only hides it at the end (and for reduced motion).
 */
export function LandingIntro() {
  const ref = useRef<HTMLDivElement>(null);
  const [show] = useState(() => (typeof window === "undefined" ? true : !hasPlayed));

  useEffect(() => {
    hasPlayed = true;
    if (!show) return;
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.skip = "true";
      return;
    }

    const hide = () => {
      el.dataset.skip = "true";
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === el) hide();
    };
    el.addEventListener("animationend", onEnd);
    const fallback = window.setTimeout(hide, 3900);
    return () => {
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div ref={ref} className={styles.intro} aria-hidden="true">
      <div className={styles.introStack}>
        <span className={styles.introMark}>
          <FluxychatMark size={20} />
        </span>
        <span className={styles.introWord}>
          {Array.from("FluxyChat").map((letter, index) => (
            <span
              key={index}
              className={styles.introLetter}
              style={{ "--i": index } as CSSProperties}
            >
              {letter}
            </span>
          ))}
        </span>
        <span className={styles.introRule} />
        <span className={styles.introMeta}>Humans and agents in the same room.</span>
      </div>
    </div>
  );
}
