"use client";

import { useEffect } from "react";
import { LandingCursor } from "./landing-cursor";

/**
 * Landing-only motion: pointer, one-shot section settles and the chapter scene.
 * Enhancements only; without JS the page is complete. Everything is off under
 * prefers-reduced-motion.
 */
export function LandingMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    if (!reduced && "IntersectionObserver" in window) {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-fx]"));
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            (entry.target as HTMLElement).dataset.fx = "in";
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
      );

      for (const section of sections) {
        if (section.getBoundingClientRect().top > window.innerHeight * 0.85) {
          section.dataset.fx = "away";
          observer.observe(section);
        }
      }

      cleanups.push(() => observer.disconnect());
    }

    if (!reduced) {
      const clamp = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value));
      const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-chapters]"));

      for (const scene of scenes) {
        const chapters = Array.from(scene.querySelectorAll<HTMLElement>("[data-chapter]"));
        if (chapters.length < 2) continue;
        scene.dataset.motion = "on";
        const current = scene.querySelector<HTMLElement>("[data-chapter-current]");
        let raf = 0;

        const update = () => {
          raf = 0;
          if (window.innerWidth < 901) {
            scene.style.removeProperty("--chapter-p");
            if (current) current.textContent = `01 / 0${chapters.length}`;
            for (const chapter of chapters) {
              chapter.style.opacity = "";
              chapter.style.transform = "";
            }
            return;
          }
          const rect = scene.getBoundingClientRect();
          const distance = Math.max(1, scene.offsetHeight - window.innerHeight);
          const progress = clamp(-rect.top / distance, 0, 1);
          const step = progress * (chapters.length - 1);
          scene.style.setProperty("--chapter-p", String(progress));
          if (current) {
            const active = Math.min(chapters.length, Math.max(1, Math.round(step) + 1));
            current.textContent = `${String(active).padStart(2, "0")} / ${String(chapters.length).padStart(2, "0")}`;
          }
          chapters.forEach((chapter, index) => {
            const delta = clamp(step - index, -1, 1);
            chapter.style.opacity = String(1 - Math.abs(delta));
            chapter.style.transform = `translateY(${delta * -190}px)`;
          });
        };

        const onScroll = () => {
          if (!raf) raf = requestAnimationFrame(update);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
        cleanups.push(() => {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
          if (raf) cancelAnimationFrame(raf);
          delete scene.dataset.motion;
          scene.style.removeProperty("--chapter-p");
          if (current) current.textContent = `01 / 0${chapters.length}`;
          for (const chapter of chapters) {
            chapter.style.opacity = "";
            chapter.style.transform = "";
          }
        });
      }
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return <LandingCursor hideNative />;
}
