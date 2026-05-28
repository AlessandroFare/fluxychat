"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Loader2 } from "lucide-react";

interface DemoSession {
  enabled: boolean;
  roomId: string;
  userId: string;
  token: string;
  expiresIn: number;
  readOnly?: boolean;
}

export default function DemoRoomPage() {
  const workerUrl = getPublicWorkerUrl();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${workerUrl}/demo/session`);
        const body = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            setError(body.error ?? "Demo not available on this deployment.");
          }
          return;
        }
        if (!cancelled) setSession(body as DemoSession);
      } catch {
        if (!cancelled) setError("Could not reach the Worker demo endpoint.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerUrl]);

  const client = useMemo(() => {
    if (!session?.token || !session.userId) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl,
      userId: session.userId,
      token: session.token,
    });
  }, [session, workerUrl]);

  const { messages, sendMessage, connectionState, connected } = useChat({
    roomId: session?.roomId ?? "",
    client: client ?? undefined,
    replay: "connect",
  });

  const readOnly = session?.readOnly === true;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/landing" className="text-brand hover:underline">
          ← Landing
        </Link>
        {" · "}
        <Link href="/compare" className="text-brand hover:underline">
          Compare
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold">Demo room</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Read-only or guest chat when the operator configures{" "}
        <code className="text-xs">DEMO_ROOM_ID</code> and{" "}
        <code className="text-xs">DEMO_API_KEY</code> on the Worker. No Clerk signup.{" "}
        <Link href="/guides/agent-events-same-websocket-stream" className="text-brand hover:underline">
          Agent events on the same stream →
        </Link>
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!session && !error ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading demo session…
        </p>
      ) : null}

      {session?.enabled ? (
        <div className="mt-8 space-y-4">
          <p className="text-xs text-muted-foreground">
            Room <code className="font-mono">{session.roomId}</code> ·{" "}
            {connectionState.status}
            {connected ? " · live" : ""}
            {readOnly ? " · read-only" : ""}
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
            {messages.map((m) => (
              <div key={`${m.id}-${m.clientMessageId ?? ""}`} className="text-sm">
                <span className="font-medium">{m.userId}</span>: {m.content}
                {m.deliveryStatus ? (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    ({m.deliveryStatus})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {!readOnly ? (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const text = draft.trim();
                if (!text) return;
                sendMessage(text);
                setDraft("");
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Say hello…"
                disabled={!connected}
              />
              <Button type="submit" className="sm:w-auto" disabled={!connected || !draft.trim()}>
                Send
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              Demo is read-only. Sign up for a full account to send messages.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
