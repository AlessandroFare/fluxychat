"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/** Modal overlay above Leaflet map panes (z-index ~1000). */
export function FleetModal({
  open,
  onClose,
  children,
  className = "w-96",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface AddressSearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: { displayName: string; lat: number; lng: number }) => void;
  placeholder?: string;
}

export function AddressSearchField({
  label,
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
}: AddressSearchFieldProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipSearchRef = useRef(false);
  const blurTimerRef = useRef<number | null>(null);

  const [suggestions, setSuggestions] = useState<Array<{ displayName: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  const selectSuggestion = useCallback(
    (result: { displayName: string; lat: number; lng: number }) => {
      skipSearchRef.current = true;
      onChange(result.displayName);
      onSelect(result);
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setHasSearched(false);
    },
    [onChange, onSelect],
  );

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setHasSearched(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setHasSearched(false);
      try {
        const { searchAddresses } = await import("@/lib/geocode");
        const results = await searchAddresses(q);
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(results.length > 0 ? 0 : -1);
        setHasSearched(true);
      } catch {
        setSuggestions([]);
        setOpen(false);
        setActiveIndex(-1);
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  const showDropdown = open && (suggestions.length > 0 || (hasSearched && !searching));

  return (
    <div className="relative mb-2">
      <label htmlFor={listboxId} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={listboxId}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={`${listboxId}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-8 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={(e) => {
            skipSearchRef.current = false;
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (!showDropdown && e.key !== "Escape") return;

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => (i + 1) % Math.max(suggestions.length, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) =>
                i <= 0 ? suggestions.length - 1 : i - 1,
              );
            } else if (e.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
              e.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
            }
          }}
        />
        {searching ? (
          <Loader2
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {showDropdown ? (
        <ul
          id={`${listboxId}-listbox`}
          role="listbox"
          className="absolute z-[10000] mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          {suggestions.length > 0 ? (
            suggestions.map((s, index) => (
              <li key={`${s.lat}-${s.lng}-${index}`} role="presentation">
                <button
                  id={`${listboxId}-opt-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-xs leading-snug",
                    index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                >
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-60" aria-hidden />
                  <span>{s.displayName}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-muted-foreground">No addresses found</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
