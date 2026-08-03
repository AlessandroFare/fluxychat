"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { filterDocSearchIndex } from "@/lib/guides-search-index";
import { cn } from "@/lib/utils";

interface LocalGuideSearchProps {
  variant?: "dark" | "light";
  className?: string;
}

export function LocalGuideSearch({ variant = "dark", className }: LocalGuideSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => filterDocSearchIndex(query), [query]);
  const isDark = variant === "dark";

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
          isDark ? "text-slate-400" : "text-muted-foreground",
        )}
      />
      <input
        type="search"
        value={query}
        placeholder="Search guides…"
        aria-label="Search guides"
        aria-expanded={open && results.length > 0}
        aria-controls="local-guide-search-results"
        className={cn(
          "w-full rounded-xl border px-10 py-2.5 text-sm outline-none transition",
          isDark
            ? "border-white/10 bg-white/5 text-slate-300 placeholder:text-slate-500 focus:border-blue-400/40 focus:bg-white/10"
            : "border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary/40",
        )}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && query.trim() && (
        <ul
          id="local-guide-search-results"
          className={cn(
            "absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border shadow-lg",
            isDark
              ? "border-white/10 bg-slate-900"
              : "border-border bg-background",
          )}
        >
          {results.length === 0 ? (
            <li className={cn("px-4 py-3 text-sm", isDark ? "text-slate-400" : "text-muted-foreground")}>
              No guides match &ldquo;{query}&rdquo;
            </li>
          ) : (
            results.map((entry) => (
              <li key={`${entry.href}-${entry.title}`}>
                {entry.external ? (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "block px-4 py-3 text-sm transition hover:bg-muted/50",
                      isDark ? "text-slate-200" : "text-foreground",
                    )}
                  >
                    <span className="font-medium">{entry.title}</span>
                    {entry.snippet ? (
                      <span className={cn("mt-0.5 block text-xs", isDark ? "text-slate-500" : "text-muted-foreground")}>
                        {entry.snippet}
                      </span>
                    ) : null}
                  </a>
                ) : (
                  <Link
                    href={entry.href}
                    className={cn(
                      "block px-4 py-3 text-sm transition hover:bg-muted/50",
                      isDark ? "text-slate-200" : "text-foreground",
                    )}
                  >
                    <span className="font-medium">{entry.title}</span>
                    {entry.snippet ? (
                      <span className={cn("mt-0.5 block text-xs", isDark ? "text-slate-500" : "text-muted-foreground")}>
                        {entry.snippet}
                      </span>
                    ) : null}
                  </Link>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
