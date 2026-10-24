"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bold, Italic, List, Heading1, Heading2, Code, Undo2, Redo2 } from "lucide-react";
import { useYjs } from "./yjs-provider";
import CollabPresenceChip from "./collab-presence-chip";

export default function CollabNotes() {
  const { doc, ytext, undoManager } = useYjs();
  const [content, setContent] = useState("");
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
      <div className="flex items-center justify-between border-t px-3 py-1">
        <CollabPresenceChip />
      </div>
    </div>
  );
}
