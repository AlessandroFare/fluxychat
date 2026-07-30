"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PinOff, Pin, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "~/components/ui/button";

interface PinItem {
  id: string;
  messageId: number;
  pinnedBy: string;
  category: string;
  sortOrder: number;
  createdAt: string;
  message: {
    content: string;
    userId: string;
    createdAt: string;
  };
}

interface PinnedMessagesBarProps {
  pins: PinItem[];
  onUnpin: (messageId: number) => Promise<void>;
  onJumpToMessage: (messageId: number) => void;
  canManage?: boolean;
  className?: string;
}

export function PinnedMessagesBar({ pins, onUnpin, onJumpToMessage, canManage, className }: PinnedMessagesBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [unpinning, setUnpinning] = useState<number | null>(null);

  if (!pins.length) return null;

  const handleUnpin = async (messageId: number) => {
    setUnpinning(messageId);
    try { await onUnpin(messageId); } finally { setUnpinning(null); }
  };

  return (
    <div className={cn("border-b border-border bg-muted/20 px-3 py-1.5", className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/70 hover:text-foreground"
          onClick={() => setCollapsed((p) => !p)}
        >
          <Pin className="h-3 w-3" />
          {pins.length} pinned
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-1 space-y-1">
          {pins.map((pin) => (
            <div key={pin.id} className="flex items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/30 group">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-muted-foreground hover:text-foreground"
                onClick={() => onJumpToMessage(pin.messageId)}
                title={pin.message.content}
              >
                <span className="font-medium text-foreground/80">{pin.category}:</span>{" "}
                {pin.message.content || "(no content)"}
              </button>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 shrink-0 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleUnpin(pin.messageId)}
                  disabled={unpinning === pin.messageId}
                  title="Unpin"
                >
                  {unpinning === pin.messageId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PinOff className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
