"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useYjs } from "./yjs-provider";
import CollabPresenceChip from "./collab-presence-chip";
import { sanitizeHtmlFragment } from "@/lib/sanitize-html";

export default function CollabDocument() {
  const { doc, ymap } = useYjs();
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState("");
  const syncingRef = useRef(false);
  const docKey = "documentEditor";

  useEffect(() => {
    if (!ymap) return;
    const saved = ymap.get(docKey);
    if (typeof saved === "string" && saved) {
      setHtml(sanitizeHtmlFragment(saved));
    }
    const observer = () => {
      if (syncingRef.current) return;
      const v = ymap.get(docKey);
      if (typeof v === "string") setHtml(sanitizeHtmlFragment(v));
    };
    ymap.observe(observer);
    return () => ymap.unobserve(observer);
  }, [ymap]);

  const handleInput = useCallback(() => {
    if (!editorRef.current || !ymap || !doc) return;
    // Local typing is already in the DOM: re-rendering dangerouslySetInnerHTML from
    // state would replace the text node and drop the caret.
    const content = sanitizeHtmlFragment(editorRef.current.innerHTML);
    syncingRef.current = true;
    doc.transact(() => { ymap.set(docKey, content); });
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [ymap, doc]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return; // plain text: the browser default is already safe
    e.preventDefault();
    document.execCommand("insertHTML", false, sanitizeHtmlFragment(html));
    handleInput();
  }, [handleInput]);

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    handleInput();
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        {[
          ["bold", "B"], ["italic", "I"], ["underline", "U"],
          ["strikeThrough", "S"], ["insertOrderedList", "OL"], ["insertUnorderedList", "UL"],
          ["formatBlock", "H1", "h1"], ["formatBlock", "H2", "h2"], ["formatBlock", "P", "¶"],
        ].map(([cmd, label, val]) => (
          <button
            key={String(cmd) + String(val || "")}
            className="rounded px-2 py-1 text-xs font-medium hover:bg-muted"
            onClick={() => execCmd(cmd as string, val as string | undefined)}
          >
            {label as string}
          </button>
        ))}
        <span className="ml-auto">
          <CollabPresenceChip />
        </span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 overflow-y-auto p-4 text-sm outline-none leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={handleInput}
      />
    </div>
  );
}
