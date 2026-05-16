"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const SCENES = [
  {
    kicker: "Step 1",
    title: "Install",
    body: "One dependency. No native binaries, no sidecar.",
    visual: (
      <div className="rounded-xl border border-orange-400/40 bg-zinc-950/95 px-5 py-4 font-mono text-base shadow-inner sm:text-lg">
        <span className="text-orange-400">$ </span>
        <span className="text-zinc-100">pnpm add </span>
        <span className="text-emerald-400">@fluxy-chat/sdk</span>
      </div>
    ),
  },
  {
    kicker: "Step 2",
    title: "Point at your edge",
    body: "Worker URL + scoped JWT — the client never sees admin keys.",
    visual: (
      <div className="space-y-3 rounded-xl border border-white/20 bg-zinc-900/90 p-5 font-mono text-sm leading-relaxed shadow-inner sm:text-base">
        <div>
          <span className="text-violet-300">baseUrl</span>
          <span className="text-zinc-400">: </span>
          <span className="text-amber-300">&quot;https://chat…&quot;</span>
        </div>
        <div>
          <span className="text-violet-300">token</span>
          <span className="text-zinc-400">: </span>
          <span className="text-amber-300">&quot;eyJ…&quot;</span>
        </div>
      </div>
    ),
  },
  {
    kicker: "Step 3",
    title: "Open a room",
    body: "Hooks subscribe, send, and reconcile — you keep your UI primitives.",
    visual: (
      <div className="rounded-xl border border-white/20 bg-zinc-900/90 p-5 font-mono text-sm shadow-inner sm:text-base">
        <span className="text-sky-300">useChat</span>
        <span className="text-zinc-300">(</span>
        <span className="text-zinc-100">{`{ roomId, client }`}</span>
        <span className="text-zinc-300">)</span>
      </div>
    ),
  },
  {
    kicker: "Live",
    title: "Ship the inbox",
    body: "Typing, delivery, and history — already moving on the wire.",
    visual: (
      <div className="flex min-h-[8rem] flex-col gap-3 rounded-xl border border-white/20 bg-zinc-900/90 p-5 shadow-inner">
        <div className="max-w-[90%] rounded-2xl rounded-tl-md border border-white/15 bg-slate-600 px-4 py-2.5 text-sm font-medium leading-snug text-white">
          Hey — is the edge worker up?
        </div>
        <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md border border-orange-400/40 bg-[#e8450a] px-4 py-2.5 text-sm font-medium leading-snug text-white shadow-sm">
          Yes. Messages are live.
        </div>
        <div className="mt-1 h-1.5 w-12 animate-pulse rounded-full bg-white/30" />
      </div>
    ),
  },
] as const;

export function ProductStoryReel() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scenes = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-story-scene]"));
    if (scenes.length === 0) return;

    let observer: IntersectionObserver | null = null;
    let tl: gsap.core.Timeline | null = null;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(scenes, { opacity: 0, y: 0, filter: "none" });
      gsap.set(scenes[scenes.length - 1], { opacity: 1 });
      return;
    }

    function resetToScene0() {
      gsap.set(scenes, { opacity: 0, y: 14, filter: "blur(6px)" });
      gsap.set(scenes[0], { opacity: 1, y: 0, filter: "blur(0px)" });
    }

    resetToScene0();

    const stepOut = 0.78;
    const stepIn = 0.82;
    const dwell = 1.05;

    tl = gsap.timeline({ paused: true, defaults: { ease: "power3.inOut" }, repeat: -1, repeatDelay: 1.35 });
    tl.call(resetToScene0, undefined, 0);

    for (let i = 1; i < scenes.length; i++) {
      tl.to(
        scenes[i - 1],
        { opacity: 0, y: -10, filter: "blur(4px)", duration: stepOut },
        i === 1 ? `+=${dwell}` : `+=${dwell + 0.15}`,
      ).fromTo(
        scenes[i],
        { opacity: 0, y: 18, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: stepIn },
        "<0.08",
      );
    }

    const last = scenes.length - 1;
    tl.to(scenes[last], { opacity: 0, y: -10, filter: "blur(4px)", duration: stepOut }, `+=${dwell + 0.15}`)
      .fromTo(
        scenes[0],
        { opacity: 0, y: 18, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: stepIn },
        "<0.08",
      );

    function setPlaying(playing: boolean) {
      if (!tl) return;
      if (playing) tl.play();
      else tl.pause();
    }

    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.08);
        setPlaying(visible);
      },
      { threshold: [0, 0.08, 0.15], rootMargin: "0px 0px 10% 0px" },
    );
    observer.observe(root);

    requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const visible = rect.top < vh * 0.94 && rect.bottom > vh * 0.06;
      setPlaying(visible);
    });

    return () => {
      observer?.disconnect();
      tl?.kill();
    };
  }, []);

  return (
    <section
      className="border-b border-border bg-[var(--am-whisper-gray)] px-4 py-14 sm:px-6 sm:py-18"
      aria-labelledby="product-story-reel-heading"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="product-story-reel-heading"
          className="text-center font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          From blank repo to live threads
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground sm:text-base">
          Install, connect, hooks, live messages — loops below and pauses when you scroll away.
        </p>

        {/* Ridotto: max-w-4xl invece di max-w-5xl/6xl, altezza clamp più bassa */}
        <div
          ref={rootRef}
          className={cn(
            "relative mx-auto mt-10 w-full max-w-4xl overflow-hidden rounded-3xl",
            "border border-orange-500/25 bg-slate-950 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.5)]",
          )}
          style={{
            minHeight: "clamp(300px, 42vw, 460px)",
            height: "clamp(300px, 42vw, 460px)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_-8%,rgba(255,115,94,0.38),rgba(255,115,94,0.12)_42%,transparent_58%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-orange-500/10 to-transparent" />

          {SCENES.map((scene, index) => (
            <div
              key={scene.title}
              data-story-scene
              className={cn(
                "absolute inset-0 flex flex-col justify-center px-6 py-8 sm:px-12 sm:py-10",
                index === 0 ? "opacity-100" : "opacity-0",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400 sm:text-sm">
                {scene.kicker}
              </p>
              <h3 className="mt-2 font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {scene.title}
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-300 sm:text-base">
                {scene.body}
              </p>
              <div className="mt-6 w-full max-w-lg">{scene.visual}</div>
              <div className="mt-5 flex gap-1.5" aria-hidden>
                {SCENES.map((_, dot) => (
                  <span
                    key={dot}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      dot === index ? "w-6 bg-orange-400" : "w-1.5 bg-white/25",
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}