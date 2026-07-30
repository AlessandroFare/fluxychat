"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bold, Italic, List, Heading1, Heading2, Code, Undo2, Redo2 } from "lucide-react";
import { useYjs } from "./yjs-provider";

export default function CollabNotes() {
  const { doc, ytext, connected, awareness, undoManager } = useYjs();
  const [content, setContent] = useState("");
  const [remoteUsers, setRemoteUsers] = useState<string[]>([]);
  const syncingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ytext) return;
    setContent(ytext.toString());
    const observer = () => {
      if (syncingRef.current) return;
      setContent(ytext.toString());
    };
    ytext.observe(observer);
    return () => ytext.unobserve(observer);
  }, [ytext]);

  useEffect(() => {
    setRemoteUsers([...awareness.values()].map((a) => a.name || a.userId));
  }, [awareness]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (!ytext || !doc) return;
    try {
      syncingRef.current = true;
      doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, val);
      });
      setTimeout(() => { syncingRef.current = false; }, 50);
    } catch { syncingRef.current = false; }
  }, [ytext, doc]);

  const insertAtCursor = useCallback((before: string, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = content;
    const newVal = val.slice(0, start) + before + val.slice(start, end) + after + val.slice(end);
    setContent(newVal);
    if (ytext && doc) {
      doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newVal);
      });
    }
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (end - start));
    }, 0);
  }, [ytext, doc, content]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <button onClick={() => insertAtCursor("**", "**")} className="rounded p-1 hover:bg-muted" title="Bold"><Bold className="h-3.5 w-3.5" /></button>
        <button onClick={() => insertAtCursor("_", "_")} className="rounded p-1 hover:bg-muted" title="Italic"><Italic className="h-3.5 w-3.5" /></button>
        <button onClick={() => insertAtCursor("- ") } className="rounded p-1 hover:bg-muted" title="List"><List className="h-3.5 w-3.5" /></button>
        <button onClick={() => insertAtCursor("# ") } className="rounded p-1 hover:bg-muted" title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></button>
        <button onClick={() => insertAtCursor("## ") } className="rounded p-1 hover:bg-muted" title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></button>
        <button onClick={() => insertAtCursor("`", "`") } className="rounded p-1 hover:bg-muted" title="Code"><Code className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => undoManager?.undo()} className="rounded p-1 hover:bg-muted" title="Undo"><Undo2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => undoManager?.redo()} className="rounded p-1 hover:bg-muted" title="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
          {remoteUsers.length > 0 && (
            <div className="ml-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              {remoteUsers.slice(0, 3).map((u, i) => (
                <span key={i} className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                  {u.charAt(0).toUpperCase()}
                </span>
              ))}
              {remoteUsers.length > 3 && <span className="text-muted-foreground">+{remoteUsers.length - 3}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 p-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          className="h-full w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
          placeholder="Start typing collaborative notes..."
        />
      </div>
      <div className="border-t px-3 py-1 text-[10px] text-muted-foreground">
        {connected ? `${remoteUsers.length > 0 ? `${remoteUsers.length} user${remoteUsers.length > 1 ? "s" : ""} online` : "Connected. No other users."}` : "Connecting..."}
      </div>
    </div>
  );
}
