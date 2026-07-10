import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Left-hand panel of a feature showcase section: heading, blurb, and a
 * lightly highlighted code snippet — mirrors the "code + live preview"
 * layout of realtime-SDK landing pages.
 */
export function FeatureCodePanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <h3 className="text-balance text-xl font-semibold text-foreground">{title}</h3>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
      <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground shadow-sm">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** Syntax accent helpers for hand-written snippets. */
export function Kw({ children }: { children: ReactNode }) {
  return <span className="text-[var(--fluxy-cta-color)]">{children}</span>;
}

export function Ident({ children }: { children: ReactNode }) {
  return <span className="text-[var(--fluxy-logo-color)]">{children}</span>;
}

export function Str({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** Right-hand live preview frame. */
export function FeaturePreviewFrame({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg",
        className,
      )}
      aria-label={label}
    >
      {children}
    </div>
  );
}

/** Shown when the Worker demo session is not configured. */
export function ShowcaseUnavailable({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {error ?? "Live demo session not available."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        Retry
      </button>
    </div>
  );
}
