"use client";

import React from "react";
import { useYjs } from "./yjs-provider";

/** Shared presence readout for the collab content surfaces (board, doc, notes). */
export default function CollabPresenceChip() {
  const { connected, awareness } = useYjs();
  const users = [...awareness.values()].map((a) => a.name || a.userId);
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      {users.length > 0 && (
        <div className="flex items-center gap-1">
          {users.slice(0, 3).map((u, i) => (
            <span
              key={`${u}-${i}`}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
            >
              {u.charAt(0).toUpperCase()}
            </span>
          ))}
          {users.length > 3 && <span>+{users.length - 3}</span>}
        </div>
      )}
      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500"}`} />
        {connected ? "Live" : "Offline"}
      </span>
    </div>
  );
}
