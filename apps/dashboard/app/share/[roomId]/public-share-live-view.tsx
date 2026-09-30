"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useChat } from "@fluxy-chat/react";
import { applyFluxyTheme, ChatWindow, fluxyThemeClassName } from "@fluxy-chat/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { isShareableToken } from "@/lib/public-share-url";

const WORKER = getPublicWorkerUrl();

type ShareMeta = {
  ok: true;
  roomId: string;
  name: string;
  shareToken?: string;
  guestEnabled: boolean;
  guestReadOnly: boolean;
};

function PublicShareChat({
  roomId,
  title,
  client,
}: {
  roomId: string;
  title: string;
  client: FluxyChatClient;
}) {
  const { messages, connectionState, typingUsers, online, agentTyping } = useChat({
    roomId,
    client,
  });
  const safeMessages = messages.filter((m) => {
    const vis = (m as { visibility?: string }).visibility;
    if (vis === "whisper" || (typeof vis === "string" && vis.startsWith("role:"))) return false;
    return true;
  });
  const status = connectionState.status;

  return (
    <div className={fluxyThemeClassName("default")} role="region" aria-label={title}>
      <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
        {status}
        {agentTyping ? " · agent thinking" : ""}
      </p>
      <ChatWindow
        messages={safeMessages}
        online={online}
        typingUsers={typingUsers}
        agentTyping={agentTyping && !messages.some((m) => m.streaming)}
        agentTypingLabel="Agent thinking"
        localUserId={client.userId}
        readOnly
      />
    </div>
  );
}

export function PublicShareLiveView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shareToken = String(params.roomId ?? "").trim();
  const pk = searchParams.get("pk")?.trim() ?? "";
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [client, setClient] = useState<FluxyChatClient | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    applyFluxyTheme("default");
  }, []);

  useEffect(() => {
    if (!isShareableToken(shareToken)) {
      setMetaError("That share link is not valid.");
      setMeta(null);
      return;
    }
    let cancelled = false;
    setMetaError(null);
    setMeta(null);
    setClient(null);
    setJoinError(null);
    void fetch(`${WORKER}/public/share/${encodeURIComponent(shareToken)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | ShareMeta
          | { error?: string }
          | null;
        if (cancelled) return;
        if (!res.ok || !body || !("ok" in body) || body.ok !== true) {
          const err = body && "error" in body ? body.error : null;
          if (res.status === 404 || err === "not_public") {
            setMetaError("This is not a public room. Group and DM rooms stay behind sign-in.");
            return;
          }
          if (res.status === 429) {
            setMetaError("Too many lookups from this network. Wait a minute and refresh.");
            return;
          }
          setMetaError("Could not load this share link.");
          return;
        }
        setMeta(body);
      })
      .catch(() => {
        if (!cancelled) setMetaError("Could not reach the chat Worker.");
      });
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  useEffect(() => {
    if (!meta?.ok) return;
    if (!meta.guestEnabled) {
      setJoinError("Public guest join is off on this Worker.");
      return;
    }
    let cancelled = false;
    void FluxyChatClient.joinPublicRoomAsGuest(WORKER, meta.roomId, {
      displayName: "Share viewer",
      publishableKey: pk.startsWith("pk_") ? pk : undefined,
      shareToken: meta.shareToken || shareToken,
    })
      .then((session) => {
        if (cancelled) return;
        setClient(
          new FluxyChatClient({
            baseUrl: WORKER,
            userId: session.userId,
            token: session.token,
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Guest join failed";
        if (msg.includes("403") || msg.includes("401")) {
          setJoinError(
            "Guest join was refused. If this Worker requires a publishable key, add ?pk=pk_… to the URL. Never put an fc_ key in a share link.",
          );
          return;
        }
        setJoinError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [meta, pk, shareToken]);

  if (metaError) {
    return (
      <div className="max-w-xl">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Live room</h1>
        <p className="mt-3 text-sm text-muted-foreground">{metaError}</p>
        <Link href={HOSTED_PATHS.landing} className="mt-6 inline-block text-sm text-primary">
          Back to home
        </Link>
      </div>
    );
  }

  if (!meta) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading share…
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Public live view
      </p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">{meta.name}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Spectator mode. You see the public timeline; this URL has no composer. Whispers, tool
        arguments, and <code>visibleTo</code> are not rendered here. Hosted is beta.
        {meta.guestReadOnly
          ? " This Worker also has guest writes off."
          : " Other guest surfaces on this Worker may still allow writes."}
      </p>
      {joinError ? (
        <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">{joinError}</p>
      ) : null}
      {client ? (
        <div className="mt-8">
          <PublicShareChat roomId={meta.roomId} title={meta.name} client={client} />
        </div>
      ) : !joinError ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          Joining as guest…
        </p>
      ) : null}
      <p className="mt-6 text-xs text-muted-foreground">
        <a
          href="https://github.com/AlessandroFare/fluxychat"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Source on GitHub
        </a>
      </p>
    </div>
  );
}
