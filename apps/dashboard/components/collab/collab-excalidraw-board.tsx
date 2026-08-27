"use client";

import "@excalidraw/excalidraw/index.css";
import "./collab-excalidraw.css";
import { Excalidraw } from "@excalidraw/excalidraw";

export interface CollabExcalidrawBoardProps {
  onChange: (elements: readonly unknown[]) => void;
  onApi: (api: unknown) => void;
  theme: "light" | "dark";
}

export default function CollabExcalidrawBoard({
  onChange,
  onApi,
  theme,
}: CollabExcalidrawBoardProps) {
  return (
    <Excalidraw
      onChange={onChange}
      excalidrawAPI={onApi}
      theme={theme}
      viewModeEnabled={false}
      zenModeEnabled={false}
      gridModeEnabled={false}
      initialData={{
        appState: {
          zoom: { value: 1 as number & { _brand: "normalizedZoom" } },
          scrollX: 0,
          scrollY: 0,
        },
      }}
    />
  );
}
