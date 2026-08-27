"use client";

import { useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";
import {
  ChatWindow,
  applyFluxyTheme,
  fluxyThemeClassName,
} from "@fluxy-chat/ui";
import type { FluxyThemeId } from "@fluxy-chat/ui";

export interface FluxyChatWidgetProps {
  roomId: string;
  /** Pre-built client — preferred when sharing with inbox */
  client?: FluxyChatClient;
  workerUrl?: string;
  token?: string;
  userId?: string;
  /** Join a public room with joinPublicRoomAsGuest (no member JWT). */
  guest?: boolean;
  displayName?: string;
  theme?: FluxyThemeId;
  className?: string;
  height?: string | number;
  title?: string;
}

function WidgetInner({
  roomId,
  title,
  client,
}: {
  roomId: string;
  title?: string;
  client: FluxyChatClient;
}) {
  const { messages, sendMessage, connectionState, typingUsers, online } = useChat({
    roomId,
    client,
    markReadLatest: true,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {title && (
        <header className="border-b border-border px-4 py-2 text-sm font-semibold">
          {title}
          <span className="ml-2 font-normal text-muted-foreground">
            {connectionState.status}
          </span>
        </header>
      )}
      <div className="min-h-0 flex-1">
        <ChatWindow
          messages={messages}
          online={online}
          typingUsers={typingUsers}
          onSend={(text) => sendMessage(text)}
        />
      </div>
    </div>
  );
}

/** Drop-in chat widget — polished UI out of the box. */
export function FluxyChatWidget({
  roomId,
  client: clientProp,
  workerUrl,
  token,
  userId = "user-1",
  guest = false,
  displayName,
  theme = "default",
  className,
  height = 480,
  title,
}: FluxyChatWidgetProps) {
  const tokenClient = useMemo(() => {
    if (clientProp) return clientProp;
    if (!workerUrl?.trim() || !token?.trim()) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl.trim(),
      userId,
      token: token.trim(),
    });
  }, [clientProp, workerUrl, token, userId]);

  const [guestClient, setGuestClient] = useState<FluxyChatClient | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    applyFluxyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (clientProp || token?.trim() || !guest || !workerUrl?.trim()) {
      setGuestClient(null);
      setGuestError(null);
      return;
    }
    let cancelled = false;
    void FluxyChatClient.joinPublicRoomAsGuest(workerUrl.trim(), roomId, { displayName })
      .then((session) => {
        if (cancelled) return;
        setGuestClient(
          new FluxyChatClient({
            baseUrl: workerUrl.trim(),
            userId: session.userId,
            token: session.token,
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGuestError(err instanceof Error ? err.message : "Guest join failed");
      });
    return () => {
      cancelled = true;
    };
  }, [clientProp, token, guest, workerUrl, roomId, displayName]);

  const client = tokenClient ?? guestClient;

  if (!client) {
    return (
      <div
        className={className}
        style={{ height, padding: 16, border: "1px solid #e4e4e7", borderRadius: 12 }}
      >
        <p style={{ margin: 0, fontSize: 14 }}>
          {guestError ??
            "Set workerUrl plus token, pass guest on a public room, or pass a client."}
        </p>
      </div>
    );
  }

  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={[fluxyThemeClassName(theme), className].filter(Boolean).join(" ")}
      style={{
        height: h,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid #e4e4e7",
      }}
    >
      <WidgetInner roomId={roomId} title={title ?? roomId} client={client} />
    </div>
  );
}
