"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useRef } from "react";
import { useYjs } from "./yjs-provider";

const ExcalidrawBoard = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => {
    function Board({
      onChange,
      onApi,
    }: {
      onChange: (elements: readonly unknown[]) => void;
      onApi: (api: unknown) => void;
    }) {
      return (
        <mod.Excalidraw
          onChange={onChange}
          excalidrawAPI={onApi}
          theme="light"
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
  const apiRef = useRef<{ updateScene?: (scene: { elements: unknown[] }) => void } | null>(null);
  const syncingRef = useRef(false);

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

  return (
    <div className="relative h-full w-full">
      <div className={cn(
        "absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium",
        connected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700",
      )}>
        {connected ? "● Excalidraw + Yjs" : "○ Offline"}
      </div>
      <ExcalidrawBoard
        onChange={onChange}
        onApi={(api) => { apiRef.current = api as typeof apiRef.current; }}
      />
    </div>
  );
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
