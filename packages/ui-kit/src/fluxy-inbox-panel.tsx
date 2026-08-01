"use client";

import { useMemo } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useInbox } from "@fluxy-chat/react";
import type { FluxyInboxItem } from "@fluxy-chat/react";

export interface FluxyInboxPanelProps {
  client?: FluxyChatClient;
  workerUrl?: string;
  token?: string;
  userId?: string;
  onSelectItem?: (item: FluxyInboxItem) => void;
  className?: string;
  height?: string | number;
}

function InboxList({
  onSelectItem,
  client,
}: {
  onSelectItem?: (item: FluxyInboxItem) => void;
  client: FluxyChatClient;
}) {
  const { items, unseen } = useInbox({
    client,
    onItem: (item) => onSelectItem?.(item),
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2 text-sm font-semibold">
        <span>Inbox</span>
        {unseen > 0 && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">
            {unseen}
          </span>
        )}
      </header>
      <ul className="flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <li className="p-4 text-center text-sm text-muted-foreground">No items yet</li>
        )}
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="mb-1 w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onSelectItem?.(item)}
            >
              <div className="font-medium">{item.roomName ?? item.kind}</div>
              <div className="text-xs text-muted-foreground">{item.roomId}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Unified inbox panel with unseen badge and mark-read. */
export function FluxyInboxPanel({
  client: clientProp,
  workerUrl,
  token,
  userId = "user-1",
  onSelectItem,
  className,
  height = 360,
}: FluxyInboxPanelProps) {
  const client = useMemo(() => {
    if (clientProp) return clientProp;
    if (!workerUrl?.trim() || !token?.trim()) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl.trim(),
      userId,
      token: token.trim(),
    });
  }, [clientProp, workerUrl, token, userId]);

  if (!client) return null;

  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={className}
      style={{ height: h, borderRadius: 12, border: "1px solid #e4e4e7", overflow: "hidden" }}
    >
      <InboxList onSelectItem={onSelectItem} client={client} />
    </div>
  );
}
