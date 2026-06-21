"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface Option {
  id: string;
  label: string;
  logoUrl?: string;
}

interface SearchableSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  idPrefix?: string;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Search...",
  emptyMessage = "No matches",
  idPrefix = "searchable",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = search
    ? options.filter(
        (o) =>
          o.id.toLowerCase().includes(search.toLowerCase()) ||
          o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50"
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filter ${options.length} options...`}
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
            ) : (
              filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      option.id === value ? "bg-brand/10 font-medium text-brand" : ""
                    }`}
                  >
                    {option.logoUrl ? (
                      <img
                        src={option.logoUrl}
                        alt=""
                        className="h-4 w-4 rounded-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : null}
                    <span className="truncate">{option.label}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{option.id}</span>
                  </button>
                </li>
              ))
            )}
            {options.length > filtered.length ? (
              <li className="border-t border-border px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                Showing {filtered.length} of {options.length}
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </div>
  );
}
