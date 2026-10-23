"use client";

import { Fragment, useEffect, useRef, type CSSProperties } from "react";
import styles from "./landing-c.module.css";

/** Letters fade up one by one when the heading enters the viewport. */
export function SplitText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.classList.add(styles.splitArmed);
    let revealed = false;

    function reveal() {
      if (revealed) return;
      revealed = true;
      el?.classList.add(styles.splitIn);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }

    function onScroll() {
      if (!el) return;
      // Reveal once the top edge passes 88% of the viewport. A rect check (not
      // an IntersectionObserver) also covers anchor jumps that skip the element.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.88) reveal();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  let index = 0;

  return (
    <span ref={ref} className={styles.split}>
      {text.split(" ").map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          {wordIndex > 0 ? " " : null}
          <span className={styles.splitWord}>
            {Array.from(word).map((letter) => {
              const i = index++;
              return (
                <span
                  key={i}
                  className={styles.splitLetter}
                  style={{ "--i": i } as CSSProperties}
                >
                  {letter}
                </span>
              );
            })}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** Scroll-scrubbed highlight: the letters fill with brand orange left to right. */
export function ScrubText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const start = window.innerHeight * 0.85;
      const end = window.innerHeight * 0.3;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      el.style.setProperty("--p", `${(p * 100).toFixed(1)}%`);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={ref} className={styles.scrub}>
      {text}
    </span>
  );
}
