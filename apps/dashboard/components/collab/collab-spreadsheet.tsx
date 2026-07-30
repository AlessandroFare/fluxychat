"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { useYjs } from "./yjs-provider";

const ROWS = 50;
const COLS = 15;
const COL_LETTERS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));

function cellId(row: number, col: number) { return `${COL_LETTERS[col]}${row + 1}`; }

function evalFormula(expr: string, getCell: (id: string) => string): string {
  try {
    let e = expr.replace(/^=/, "").trim();
    const cellRefs = e.match(/[A-Z]+\d+/g) || [];
    for (const ref of cellRefs) {
      const val = getCell(ref);
      const num = Number(val);
      e = e.replace(ref, isNaN(num) ? "0" : String(num));
    }
    const safe = e.replace(/[^0-9+\-*/.() ]/g, "");
    if (!safe) return expr;
    const result = Function(`"use strict"; return (${safe})`)();
    return String(result ?? "");
  } catch { return expr; }
}

interface SheetData { [cellId: string]: string }

export default function CollabSpreadsheet() {
  const { doc, ymap, connected } = useYjs();
  const [data, setData] = useState<SheetData>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState(false);
  const syncingRef = useRef(false);
  const sheetKey = "spreadsheet";

  useEffect(() => {
    if (!ymap) return;
    const raw = ymap.get(sheetKey);
    if (raw) setData(JSON.parse(String(raw)));
    const observer = () => {
      if (syncingRef.current) return;
      const v = ymap.get(sheetKey);
      if (v) setData(JSON.parse(String(v)));
    };
    ymap.observe(observer);
    return () => ymap.unobserve(observer);
  }, [ymap]);

  const persist = useCallback((d: SheetData) => {
    if (!ymap || !doc) return;
    syncingRef.current = true;
    doc.transact(() => { ymap.set(sheetKey, JSON.stringify(d)); });
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, [ymap, doc]);

  const getCell = useCallback((id: string) => data[id] || "", [data]);

  const updateCell = (id: string, val: string) => {
    const next = { ...data };
    if (val === "" || val === undefined) delete next[id];
    else next[id] = val;
    setData(next);
    persist(next);
  };

  const handleCellClick = (id: string) => {
    setActiveCell(id);
    setEditValue(data[id] || "");
    setEditing(true);
  };

  const handleCellBlur = () => {
    if (activeCell && editValue !== (data[activeCell] || "")) {
      updateCell(activeCell, editValue);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;
    const col = COL_LETTERS.indexOf(activeCell[0]);
    const row = parseInt(activeCell.slice(1)) - 1;
    if (e.key === "Enter" && !e.shiftKey) {
      handleCellBlur();
      const nextId = row < ROWS - 1 ? cellId(row + 1, col) : null;
      if (nextId) { setActiveCell(nextId); setEditValue(data[nextId] || ""); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleCellBlur();
      const nextCol = e.shiftKey ? Math.max(0, col - 1) : Math.min(COLS - 1, col + 1);
      const nextId = cellId(row, nextCol);
      setActiveCell(nextId); setEditValue(data[nextId] || "");
    } else if (e.key === "ArrowDown" && row < ROWS - 1) {
      handleCellBlur();
      const nextId = cellId(row + 1, col);
      setActiveCell(nextId); setEditValue(data[nextId] || "");
    } else if (e.key === "ArrowUp" && row > 0) {
      handleCellBlur();
      const nextId = cellId(row - 1, col);
      setActiveCell(nextId); setEditValue(data[nextId] || "");
    }
  };

  const displayValue = (id: string) => {
    const v = data[id] || "";
    if (v.startsWith("=")) {
      return evalFormula(v, (ref) => data[ref] || "");
    }
    return v;
  };

  const activeCol = activeCell ? COL_LETTERS.indexOf(activeCell[0]) : -1;
  const activeRow = activeCell ? parseInt(activeCell.slice(1)) - 1 : -1;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500"}`} />
          {connected ? "Synced" : "Offline"}
        </div>
        {activeCell && (
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold">{activeCell}</span>
            <input
              autoFocus
              className="flex-1 rounded border bg-muted px-2 py-0.5 font-mono text-xs outline-none focus:border-primary"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCellBlur}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground">{ROWS}R × {COLS}C</div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-xs font-mono">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 h-7 min-w-[40px] border bg-muted text-muted-foreground" />
              {COL_LETTERS.map((l) => (
                <th key={l} className={`sticky top-0 z-10 h-7 min-w-[80px] border bg-muted px-1 text-muted-foreground ${activeCol === COL_LETTERS.indexOf(l) ? "bg-primary/10" : ""}`}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <td className={`sticky left-0 z-10 h-6 min-w-[40px] border bg-muted px-1 text-center text-muted-foreground ${activeRow === r ? "bg-primary/10" : ""}`}>
                  {r + 1}
                </td>
                {COL_LETTERS.map((l, c) => {
                  const id = cellId(r, c);
                  const display = displayValue(id);
                  const isActive = activeCell === id;
                  return (
                    <td
                      key={id}
                      className={`h-6 min-w-[80px] border px-1.5 cursor-cell ${isActive ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => handleCellClick(id)}
                    >
                      {isActive && editing ? (
                        <input
                          autoFocus
                          className="h-full w-full bg-transparent outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                        />
                      ) : (
                        <span className={`block truncate ${data[id]?.startsWith("=") ? "text-blue-600 dark:text-blue-400" : ""}`}>
                          {display}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
