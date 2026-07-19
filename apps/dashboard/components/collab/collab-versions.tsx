"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, Diff, Clock, GitBranch } from "lucide-react";
import { useYjs } from "./yjs-provider";
import { cn } from "@/lib/utils";

interface VersionEntry {
  id: number; timestamp: number; label: string;
  snapshot?: Uint8Array;
}

function computeDiff(before: string, after: string): { type: "add" | "remove" | "same"; text: string }[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  const result: { type: "add" | "remove" | "same"; text: string }[] = [];

  for (let i = 0; i < maxLen; i++) {
    if (i >= beforeLines.length) {
      result.push({ type: "add", text: afterLines[i] });
    } else if (i >= afterLines.length) {
      result.push({ type: "remove", text: beforeLines[i] });
    } else if (beforeLines[i] !== afterLines[i]) {
      result.push({ type: "remove", text: beforeLines[i] });
      result.push({ type: "add", text: afterLines[i] });
    } else {
      result.push({ type: "same", text: beforeLines[i] });
    }
  }
  return result;
}

export default function CollabVersions({ roomId }: { roomId: string }) {
  const { doc, undoManager, connected } = useYjs();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [currentContent, setCurrentContent] = useState("");

  useEffect(() => {
    if (!doc?.getText) return;
    const ytext = doc.getText("content");
    setCurrentContent(ytext.toString());
    const observer = () => setCurrentContent(ytext.toString());
    ytext.observe(observer);
    return () => ytext.unobserve(observer);
  }, [doc]);

  const saveVersion = useCallback(() => {
    if (!doc) return;
    const ytext = doc.getText("content");
    const newVersion: VersionEntry = {
      id: versions.length + 1,
      timestamp: Date.now(),
      label: `v${versions.length + 1}`,
    };
    setVersions((prev) => [...prev, newVersion]);
  }, [doc, versions.length]);

  useEffect(() => {
    const iv = setInterval(saveVersion, 30000);
    return () => clearInterval(iv);
  }, [saveVersion]);

  const restoreVersion = (version: VersionEntry) => {
    setSelectedVersion(version.id);
    setShowDiff(false);
  };

  const versionContent: Record<number, string> = {};
  const selectedContent = selectedVersion ? versionContent[selectedVersion] || "" : "";
  const diff = showDiff && selectedContent ? computeDiff(selectedContent, currentContent) : [];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <History className="h-4 w-4 text-muted-foreground" />
          Version History
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={saveVersion} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">
            <GitBranch className="h-3 w-3" /> Save snapshot
          </button>
          {selectedVersion && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[10px]", showDiff ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              <Diff className="h-3 w-3" /> Diff
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 overflow-y-auto border-r p-2">
          {versions.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Auto-snapshots every 30s
            </p>
          )}
          <div className="space-y-1">
            {[...versions].reverse().map((v) => (
              <button
                key={v.id}
                onClick={() => restoreVersion(v)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-xs transition-colors",
                  selectedVersion === v.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{v.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <RotateCcw className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {showDiff && diff.length > 0 ? (
            <div className="space-y-0.5 font-mono text-xs leading-relaxed">
              {diff.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded px-2 py-0.5",
                    line.type === "add" && "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
                    line.type === "remove" && "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
                  )}
                >
                  <span className="mr-2 select-none">{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}</span>
                  {line.text}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Version History</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-snapshots are saved every 30 seconds. Select a version to view or restore.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
