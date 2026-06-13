"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuickstartHref } from "@/lib/use-quickstart-href";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  buildConsoleCommandItems,
  filterConsoleCommandItems,
  groupConsoleCommandItems,
  type ConsoleCommandItemDef,
} from "@/lib/console-command-items";

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within ConsoleCommandPaletteProvider");
  }
  return ctx;
}

const SUPPORT_MAILTO =
  "mailto:fluxychat@outlook.com?subject=FluxyChat%20support";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function runCommandAction(
  item: ConsoleCommandItemDef,
  router: ReturnType<typeof useRouter>,
  onClose: () => void,
  setNotice: (msg: string | null) => void,
): void {
  if (item.href) {
    router.push(item.href);
    onClose();
    return;
  }
  if (item.action === "copy-worker-url") {
    const url = getPublicWorkerUrl();
    void navigator.clipboard.writeText(url).then(() => {
      setNotice(`Copied ${url}`);
      window.setTimeout(() => onClose(), 600);
    });
    return;
  }
  if (item.action === "open-support") {
    window.location.href = SUPPORT_MAILTO;
    onClose();
  }
}

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const quickstartHref = useQuickstartHref();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const allItems = useMemo(
    () => buildConsoleCommandItems(quickstartHref),
    [quickstartHref],
  );
  const filteredItems = useMemo(
    () => filterConsoleCommandItems(allItems, query),
    [allItems, query],
  );
  const grouped = useMemo(
    () => groupConsoleCommandItems(filteredItems),
    [filteredItems],
  );
  const flatItems = useMemo(
    () => grouped.flatMap((section) => section.items),
    [grouped],
  );

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setSelectedIndex(0);
    setNotice(null);
  }, [onOpenChange]);

  const selectItem = useCallback(
    (item: ConsoleCommandItemDef | undefined) => {
      if (!item) return;
      runCommandAction(item, router, close, setNotice);
    },
    [router, close],
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(0, flatItems.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectItem(flatItems[selectedIndex]);
    }
  }

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="command-palette"
        showCloseButton
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Search console pages and actions</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-label="Search command palette"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2" role="listbox">
          {notice ? (
            <p className="px-2 py-6 text-center text-sm text-emerald-700">{notice}</p>
          ) : flatItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">No matches.</p>
          ) : (
            grouped.map((section) => (
              <div key={section.group} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const Icon = item.icon;
                    const isSelected = index === selectedIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "text-slate-700 hover:bg-slate-50",
                          )}
                          onMouseEnter={() => setSelectedIndex(index)}
                          onClick={() => selectItem(item)}
                        >
                          {Icon ? (
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{item.label}</span>
                            {item.description ? (
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
          <span>Navigate console faster</span>
          <span className="hidden sm:inline">
            <kbd className="rounded border border-slate-200 bg-white px-1">↑</kbd>{" "}
            <kbd className="rounded border border-slate-200 bg-white px-1">↓</kbd> move ·{" "}
            <kbd className="rounded border border-slate-200 bg-white px-1">↵</kbd> select
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConsoleCommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const isK = event.key.toLowerCase() === "k";
      const withModifier = event.metaKey || event.ctrlKey;
      if (withModifier && isK) {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette }}>
      {children}
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

export function CommandPaletteTrigger({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { open } = useCommandPalette();
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-left text-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
      aria-label="Open command palette"
      data-testid="command-palette-trigger"
      {...props}
    >
      <span className="inline-flex items-center gap-2">
        <Search className="h-3.5 w-3.5 opacity-70" aria-hidden />
        Search…
      </span>
      <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}
