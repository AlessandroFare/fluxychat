"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  DemoTurnstile,
  isDemoTurnstileEnabled,
} from "@/components/demo-turnstile";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Loader2 } from "lucide-react";
import { VoiceRecorder } from "~/components/voice/voice-recorder";
import { VoiceMessageBubble } from "~/components/voice/voice-message-bubble";

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
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const loadDemoSession = useCallback(
    async (turnstileToken?: string) => {
      setError(null);
      try {
        const usePost = isDemoTurnstileEnabled();
        const res = await fetch(`${workerUrl}/demo/session`, {
          method: usePost ? "POST" : "GET",
          headers: usePost ? { "Content-Type": "application/json" } : undefined,
          body:
            usePost && turnstileToken
              ? JSON.stringify({ turnstileToken })
              : undefined,
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Demo not available on this deployment.");
          return;
        }
        setSession(body as DemoSession);
      } catch {
        setError("Could not reach the Worker demo endpoint.");
      }
    },
    [workerUrl],
  );

  useEffect(() => {
    if (isDemoTurnstileEnabled()) return;
    void loadDemoSession();
  }, [loadDemoSession]);

  const client = useMemo(() => {
    if (!session?.token || !session.userId) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl,
      userId: session.userId,
      token: session.token,
    });
  }, [session, workerUrl]);

  const readOnly = session?.readOnly === true;

  const { messages, sendMessage, connectionState, connected, loadHistory } = useChat({
    roomId: session?.roomId ?? "",
    client: client ?? undefined,
    replay: "connect",
    markReadLatest: Boolean(session && !session.readOnly),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/landing" className="text-brand underline underline-offset-2">
          ← Landing
        </Link>
        {" · "}
        <Link href="/compare" className="text-brand underline underline-offset-2">
          Compare
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold">Demo room</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Read-only or guest chat when the operator configures{" "}
        <code className="text-xs">DEMO_ROOM_ID</code> and{" "}
        <code className="text-xs">DEMO_API_KEY</code> on the Worker. No Clerk signup.{" "}
        <Link href="/guides/agent-events-same-websocket-stream" className="text-brand underline underline-offset-2">
          Agent events on the same stream
        </Link>
        {" · "}
        <Link href="/guides/offline-notify-in-app-plus-sms" className="text-brand underline underline-offset-2">
          In-app + SMS offline →
        </Link>
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isDemoTurnstileEnabled() && !session && !error ? (
        <div className="mt-8 max-w-sm space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            Complete the check below to open the guest demo room.
          </p>
          <DemoTurnstile
            onToken={(token) => void loadDemoSession(token)}
            onError={() => setError("Turnstile verification failed. Refresh and try again.")}
          />
        </div>
      ) : null}

      {!isDemoTurnstileEnabled() && !session && !error ? (
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
                <span className="font-medium">{m.userId}</span>:{" "}
                {m.kind === "voice" ? (
                  <VoiceMessageBubble message={m} className="mt-1 inline-block" />
                ) : (
                  m.content
                )}
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
                className="sm:flex-1"
              />
              <VoiceRecorder
                disabled={!connected}
                onSend={async (audio, durationMs) => {
                  if (!client) return;
                  setVoiceError(null);
                  try {
                    const sent = await client.sendVoiceMessage(session?.roomId ?? "", audio, {
                      durationMs,
                    });
                    if (!sent) setVoiceError("Voice message not sent.");
                    else void loadHistory();
                  } catch (err: unknown) {
                    setVoiceError(
                      err instanceof Error ? err.message : "Voice send failed",
                    );
                  }
                }}
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
          {voiceError ? (
            <p className="text-xs text-red-600" role="alert">
              {voiceError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
