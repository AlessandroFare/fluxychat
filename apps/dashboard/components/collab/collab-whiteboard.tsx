"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useYjs } from "./yjs-provider";
import { useTheme } from "@/app/components/theme-provider";

const MAX_CANVAS_EDGE = 4096;

const ExcalidrawBoard = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => {
    function Board({
      onChange,
      onApi,
      theme,
    }: {
      onChange: (elements: readonly unknown[]) => void;
      onApi: (api: unknown) => void;
      theme: "light" | "dark";
    }) {
      return (
        <mod.Excalidraw
          onChange={onChange}
          excalidrawAPI={onApi}
          theme={theme}
          viewModeEnabled={false}
          zenModeEnabled={false}
          gridModeEnabled={false}
        />
      );
    }
    return { default: Board };
  }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading Excalidraw…
      </div>
    ),
  },
);

export default function CollabWhiteboard() {
  const { doc, connected, yarray } = useYjs();
  const { resolvedTheme } = useTheme();
  const apiRef = useRef<{ updateScene?: (scene: { elements: unknown[] }) => void } | null>(null);
  const syncingRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [boardReady, setBoardReady] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    function clampHost() {
      const node = hostRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const maxCss = Math.floor(MAX_CANVAS_EDGE / dpr);
      if (rect.width > maxCss || rect.height > maxCss) {
        node.style.maxWidth = `${maxCss}px`;
        node.style.maxHeight = `${maxCss}px`;
      }
      setBoardReady(rect.width > 0 && rect.height > 0 && rect.width <= maxCss && rect.height <= maxCss);
    }

    clampHost();
    const ro = new ResizeObserver(clampHost);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!yarray || !apiRef.current) return;

    const observer = () => {
      if (syncingRef.current) return;
      const elementsJson = yarray.toJSON();
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
    if (!elements.length) return;
    try {
      syncingRef.current = true;
      const json = JSON.parse(JSON.stringify(elements));
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
        "absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium",
        connected
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
      )}>
        {connected ? "● Excalidraw + Yjs" : "○ Offline"}
      </div>
      <div ref={hostRef} className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
        {boardReady ? (
          <ExcalidrawBoard
            theme={theme}
            onChange={onChange}
            onApi={(api) => { apiRef.current = api as typeof apiRef.current; }}
          />
        ) : null}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
