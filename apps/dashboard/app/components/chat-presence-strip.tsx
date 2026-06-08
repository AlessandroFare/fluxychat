"use client";

import { cn } from "@/lib/utils";

export interface ChatPresenceStripProps {
  members: Array<{ userId: string; userInfo?: Record<string, unknown> }>;
  subscriptionCount: number;
  className?: string;
}

function memberLabel(userId: string, userInfo?: Record<string, unknown>): string {
  const name = userInfo?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

export function ChatPresenceStrip({
  members,
  subscriptionCount,
  className,
}: ChatPresenceStripProps) {
  if (members.length === 0 && subscriptionCount === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground",
        className,
      )}
      data-testid="chat-presence-strip"
    >
      <span className="font-medium text-foreground/80">Online</span>
      {members.length === 0 ? (
        <span>—</span>
      ) : (
        members.map((m) => (
          <span
            key={m.userId}
            className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300"
            title={m.userId}
          >
            {memberLabel(m.userId, m.userInfo)}
          </span>
        ))
      )}
      {subscriptionCount > 0 ? (
        <span className="ml-auto tabular-nums">
          {subscriptionCount} connection{subscriptionCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}
