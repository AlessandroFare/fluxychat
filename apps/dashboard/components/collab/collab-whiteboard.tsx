"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useYjs } from "./yjs-provider";

export default function CollabWhiteboard() {
  const { doc, connected, yarray } = useYjs();
  const apiRef = useRef<any>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!yarray || !apiRef.current) return;

    const observer = (event: any) => {
      if (syncingRef.current) return;
      const elementsJson = yarray.toJSON();
      if (elementsJson.length > 0 && apiRef.current) {
        try {
          syncingRef.current = true;
          apiRef.current.updateScene({ elements: JSON.parse(JSON.stringify(elementsJson)) });
        } catch { /* ignore */ } finally {
          setTimeout(() => { syncingRef.current = false; }, 50);
        }
      }
    };

    yarray.observe(observer);
    return () => yarray.unobserve(observer);
  }, [yarray]);

  const onChange = useCallback((elements: readonly any[], appState: any) => {
    if (syncingRef.current) return;
    if (!yarray || !doc) return;
    if (!elements || elements.length === 0) return;
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
      <div className={cn("absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium", connected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
        {connected ? "● Live" : "○ Offline"}
      </div>
      <Excalidraw
        onChange={onChange}
        excalidrawAPI={(api: any) => { apiRef.current = api; }}
        theme="light"
        viewModeEnabled={false}
        zenModeEnabled={false}
        gridModeEnabled={false}
      />
    </div>
  );
}

function cn(...classes: any[]) { return classes.filter(Boolean).join(" "); }
