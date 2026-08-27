"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useYjs } from "./yjs-provider";
import { useTheme } from "@/app/components/theme-provider";
import { installCanvasMaxSizeGuard, maxCssBox } from "@/lib/canvas-max-size-guard";

const ELEMENT_POS_CAP = 100_000;
const ELEMENT_SIZE_CAP = 8_192;

const ExcalidrawBoard = dynamic(() => import("./collab-excalidraw-board"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading board…
    </div>
  ),
});

function isPlausibleElement(el: unknown): el is Record<string, unknown> {
  if (!el || typeof el !== "object") return false;
  const rec = el as Record<string, unknown>;
  const pos = [rec.x, rec.y];
  const size = [rec.width, rec.height];
  const posOk = pos.every(
    (n) => n == null || (typeof n === "number" && Number.isFinite(n) && Math.abs(n) < ELEMENT_POS_CAP),
  );
  const sizeOk = size.every(
    (n) => n == null || (typeof n === "number" && Number.isFinite(n) && n >= 0 && n < ELEMENT_SIZE_CAP),
  );
  return posOk && sizeOk;
}

export default function CollabWhiteboard() {
  const { doc, connected, yarray } = useYjs();
  const { resolvedTheme } = useTheme();
  const apiRef = useRef<{
    updateScene?: (scene: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
    scrollToContent?: () => void;
  } | null>(null);
  const syncingRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => installCanvasMaxSizeGuard(), []);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    function measure() {
      const node = hostRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const { maxWidth, maxHeight } = maxCssBox(dpr);
      const parentW = node.clientWidth || rect.width;
      const parentH = node.clientHeight || rect.height;
      const availW = Math.min(parentW || window.innerWidth, maxWidth);
      const availH = Math.min(parentH || 480, maxHeight);
      const width = Math.max(280, Math.floor(availW));
      const height = Math.max(280, Math.floor(availH));
      setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!yarray || !apiRef.current) return;

    const observer = () => {
      if (syncingRef.current) return;
      const elementsJson = yarray.toJSON().filter(isPlausibleElement);
      if (elementsJson.length > 0 && apiRef.current?.updateScene) {
        try {
          syncingRef.current = true;
          apiRef.current.updateScene({ elements: JSON.parse(JSON.stringify(elementsJson)) });
        } catch {
          /* ignore malformed remote state */
        } finally {
          setTimeout(() => { syncingRef.current = false; }, 50);
        }
      }
    };

    yarray.observe(observer);
    return () => yarray.unobserve(observer);
  }, [yarray]);

  const onChange = useCallback((elements: readonly unknown[]) => {
    if (syncingRef.current) return;
    if (!yarray || !doc) return;
    const sane = elements.filter(isPlausibleElement);
    if (!sane.length) return;
    try {
      syncingRef.current = true;
      const json = JSON.parse(JSON.stringify(sane));
      doc.transact(() => {
        yarray.delete(0, yarray.length);
        yarray.push(json);
      }, "local");
      setTimeout(() => { syncingRef.current = false; }, 50);
    } catch {
      syncingRef.current = false;
    }
  }, [yarray, doc]);

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <div className={cn(
        "pointer-events-none absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium",
        connected
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
      )}>
        {connected ? "Live Yjs" : "Offline"}
      </div>
      <div ref={hostRef} className="fluxy-excalidraw-host absolute inset-0">
        {box ? (
          <div
            className="fluxy-excalidraw-host"
            style={{ width: box.width, height: box.height }}
          >
            <ExcalidrawBoard
              theme={theme}
              onChange={onChange}
              onApi={(api) => {
                apiRef.current = api as typeof apiRef.current;
                try {
                  apiRef.current?.updateScene?.({
                    appState: {
                      zoom: { value: 1 },
                      scrollX: 0,
                      scrollY: 0,
                    },
                  });
                } catch {
                  /* api not ready */
                }
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
