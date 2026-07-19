"use client";

import { cn } from "@/lib/utils";

interface UserStatusProps {
  emoji?: string | null;
  text?: string | null;
  className?: string;
}

export function UserStatusBadge({ emoji, text, className }: UserStatusProps) {
  if (!text && !emoji) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground",
        className,
      )}
      title={text || undefined}
    >
      {emoji && <span className="text-[11px]">{emoji}</span>}
      {text && <span className="max-w-[120px] truncate">{text}</span>}
    </span>
  );
}

export function UserStatusInline({ emoji, text, className }: UserStatusProps) {
  if (!text && !emoji) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)}>
      {emoji && <span className="text-xs">{emoji}</span>}
      {text}
    </span>
  );
}
