"use client";

import { useMemo, useState } from "react";
import { watchingFromOccupancy } from "@fluxy-chat/ui";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ChatPresenceMember {
  userId: string;
  userInfo?: Record<string, unknown>;
}

export interface ChatPresenceStripProps {
  members: ChatPresenceMember[];
  subscriptionCount: number;
  currentUserId?: string | null;
  typingUsers?: Record<string, boolean>;
  resolveName?: (userId: string) => string;
  className?: string;
}

function memberLabel(
  userId: string,
  userInfo?: Record<string, unknown>,
  resolveName?: (userId: string) => string,
): string {
  if (resolveName) {
    const custom = resolveName(userId).trim();
    if (custom) return custom;
  }
  const name = userInfo?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return userId.length > 12 ? `${userId.slice(0, 8)}…` : userId;
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return (label.slice(0, 2) || "?").toUpperCase();
}

export function ChatPresenceStrip({
  members,
  subscriptionCount,
  currentUserId,
  typingUsers = {},
  resolveName,
  className,
}: ChatPresenceStripProps) {
  const [listOpen, setListOpen] = useState(false);

  const watching = watchingFromOccupancy({
    connections: subscriptionCount,
    presenceMembers: members.length,
  });

  const sorted = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      if (currentUserId && a.userId === currentUserId) return -1;
      if (currentUserId && b.userId === currentUserId) return 1;
      return memberLabel(a.userId, a.userInfo, resolveName).localeCompare(
        memberLabel(b.userId, b.userInfo, resolveName),
      );
    });
    return copy;
  }, [members, currentUserId, resolveName]);

  if (members.length === 0 && subscriptionCount === 0) return null;

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground",
          className,
        )}
        data-testid="chat-presence-strip"
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/70"
          onClick={() => setListOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={listOpen}
          data-testid="chat-presence-open-list"
        >
          <span className="font-medium text-foreground/80">In chat</span>
          <span className="tabular-nums" data-testid="chat-presence-in-chat">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </button>
        {sorted.slice(0, 4).map((m) => (
          <span
            key={m.userId}
            className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300"
            title={m.userId}
          >
            {memberLabel(m.userId, m.userInfo, resolveName)}
            {typingUsers[m.userId] ? " · typing" : ""}
          </span>
        ))}
        {sorted.length > 4 ? (
          <span className="text-muted-foreground">+{sorted.length - 4}</span>
        ) : null}
        {watching ? (
          <span className="ml-auto tabular-nums" data-testid="chat-presence-watching">
            {watching} watching
          </span>
        ) : null}
      </div>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-sm" data-testid="chat-participant-list">
          <DialogHeader>
            <DialogTitle>Participants</DialogTitle>
            <DialogDescription>
              {members.length} in chat
              {watching ? ` · ${watching} watching` : ""}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 overflow-y-auto">
            {sorted.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Nobody in presence yet</li>
            ) : (
              sorted.map((m) => {
                const label = memberLabel(m.userId, m.userInfo, resolveName);
                const isSelf = Boolean(currentUserId && m.userId === currentUserId);
                const isTyping = Boolean(typingUsers[m.userId]);
                return (
                  <li
                    key={m.userId}
                    className="flex items-center gap-2 border-b border-border/40 py-2 last:border-0"
                    data-testid="chat-participant-row"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
                      {initials(label)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {label}
                      {isSelf ? (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      ) : null}
                    </span>
                    {isTyping ? (
                      <span className="text-[11px] text-brand">typing…</span>
                    ) : (
                      <span className="size-1.5 rounded-full bg-emerald-500" aria-label="present" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
