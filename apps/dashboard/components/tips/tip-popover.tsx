"use client";

import { useEffect, useId, useLayoutEffect, useState, type RefObject } from "react";
import { Popover } from "radix-ui";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TipPopoverProps {
  target: string | RefObject<HTMLElement | null>;
  title: string;
  body: string;
  stepIndex?: number;
  stepTotal?: number;
  onNext: () => void;
  onDismiss: () => void;
  onReplay: () => void;
}

interface AnchorBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

function resolveTarget(target: TipPopoverProps["target"]): HTMLElement | null {
  if (typeof target === "string") return document.querySelector(target);
  return target.current;
}

export function TipPopover({
  target,
  title,
  body,
  stepIndex,
  stepTotal,
  onNext,
  onDismiss,
  onReplay,
}: TipPopoverProps) {
  const titleId = useId();
  const descId = useId();
  const [box, setBox] = useState<AnchorBox | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    function measure() {
      const el = resolveTarget(target);
      if (!el) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      setIsMobile(window.innerWidth < 640);
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  if (!box) return null;

  return (
    <Popover.Root open modal={false}>
      <Popover.Anchor asChild>
        <div
          aria-hidden
          data-testid="tip-highlight"
          className="pointer-events-none fixed z-40 rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side={isMobile ? "top" : "right"}
          align={isMobile ? "center" : "start"}
          sideOffset={12}
          collisionPadding={16}
          aria-labelledby={titleId}
          aria-describedby={descId}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            onDismiss();
          }}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            "z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg outline-none",
            isMobile && "fixed inset-x-4 bottom-4 top-auto w-auto",
            !reduceMotion && "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Lightbulb className="size-3" aria-hidden />
              Tip
              {stepIndex != null && stepTotal != null ? (
                <span className="font-normal text-muted-foreground">
                  {stepIndex + 1}/{stepTotal}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close tip"
              onClick={onDismiss}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </p>
          <p id={descId} className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {body}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={onReplay}
            >
              Replay the tour
            </button>
            <Button type="button" size="sm" onClick={onNext}>
              Got it
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
