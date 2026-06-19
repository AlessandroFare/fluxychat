"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useChat, useFluxyChatOptional } from "@fluxy-chat/sdk";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { mentionPrefixForAgent, normalizeAgentHandle } from "@/lib/assistant-room";
import {
  normalizeAgentRun,
  type AgentRunDisplay,
} from "@/lib/agent-run-display";
import { toolCallsToThreadEvents } from "@/lib/agent-tool-thread";
import type { UseChatHistoryReplay } from "@fluxy-chat/sdk";
import { AgentToolThreadCard } from "./agent-tool-thread-card";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";
import { AgentRoomMessage } from "./agent-room-message";
import {
  AgentRoomTemplatePicker,
  type AgentRoomTemplateSelection,
} from "./agent-room-template-picker";
import { AgentRunStatus } from "./agent-run-status";
import { RoomOfflineNotifySettings } from "./room-offline-notify-settings";
import { ChatCatchUpBanner } from "./chat-catch-up-banner";
import { ChatPresenceStrip } from "./chat-presence-strip";
import { AgentCopilotConfirm } from "./agent-copilot-confirm";
import { useRoomDraftSync } from "@/lib/use-room-draft-sync";
import type { FluxySendMessageOptions } from "@fluxy-chat/sdk";
import { Button, Input } from "./ui";
import { VoiceRecorder } from "~/components/voice/voice-recorder";
import { ReplySuggestions } from "./reply-suggestions";
import { AgentHandoffBanner } from "./agent-handoff-banner";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();
const RUN_POLL_MS = 2000;
const RUN_POLL_TIMEOUT_MS = 60_000;
const SKIP_HISTORY_STORAGE_KEY = "fluxychat.agentChat.skipHistory";

function displayUserId(message: { userId?: string | null }): string {
  return message.userId?.trim() || "unknown";
}

export interface AgentRoomChatProps {
  roomId: string;
  agentId: string;
  agentName: string;
  agentHandle?: string | null;
  /** Admin JWT to poll /agents/:id/runs after @mention invoke. */
  adminJwt?: string;
  /** Member JWT for per-room SMS / notify preferences. */
  memberJwt?: string;
  memberUserId?: string;
  /** When true (default), show preview and require confirm before send/invoke. */
  coPilotConfirm?: boolean;
  /** Override history/replay limit (e.g. deep link `replayLimit`). */
  deepLinkHistoryLimit?: number;
  /** Scroll to message after history loads (deep link `messageId`). */
  scrollToMessageId?: number;
  className?: string;
}

interface PendingComposePayload {
  templateSend: AgentRoomTemplateSelection | null;
  text: string;
  parentId: number | null;
}

export function AgentRoomChat({
  roomId,
  agentId,
  agentName,
  agentHandle,
  adminJwt = "",
  memberJwt = "",
  memberUserId,
  coPilotConfirm: coPilotConfirmDefault = true,
  deepLinkHistoryLimit: deepLinkHistoryLimitProp,
  scrollToMessageId: scrollToMessageIdProp,
  className,
}: AgentRoomChatProps) {
  const searchParams = useSearchParams();
  const deepLinkHistoryLimit =
    deepLinkHistoryLimitProp ??
    (Number(searchParams.get("replayLimit")) || undefined);
  const scrollToMessageId =
    scrollToMessageIdProp ?? (Number(searchParams.get("messageId")) || undefined);
  const deepLinkReplay = searchParams.get("replay") === "1";
  const [confirmBeforeSend, setConfirmBeforeSend] = useState(coPilotConfirmDefault);
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [ephemeralTtlSeconds, setEphemeralTtlSeconds] = useState(0);
  const [whisperMode, setWhisperMode] = useState(false);
  const [whisperTo, setWhisperTo] = useState("");
  const [pendingCompose, setPendingCompose] = useState<{
    previewText: string;
    modeLabel: string;
    payload: PendingComposePayload;
  } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<AgentRunDisplay | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);
  const [skipHistoryOnConnect, setSkipHistoryOnConnect] = useState(false);
  const [templateSelection, setTemplateSelection] =
    useState<AgentRoomTemplateSelection | null>(null);
  const pollSinceRef = useRef<string | null>(null);
  const runFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { user: clerkUser } = useClerkUser();
  const realtime = useFluxyChatOptional();
  const fluxyClient = realtime?.client ?? null;

  const localUserId = clerkUser?.id
    ? fluxyUserIdFromClerk(clerkUser.id)
    : undefined;

  const trimmedRoomId = roomId.trim();
  const mentionHandle = normalizeAgentHandle(agentHandle);
  const usesMentionInvoke = Boolean(mentionHandle);

  useEffect(() => {
    try {
      setSkipHistoryOnConnect(localStorage.getItem(SKIP_HISTORY_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const replay: UseChatHistoryReplay = skipHistoryOnConnect
    ? "request"
    : deepLinkReplay
      ? "connect"
      : "connect";

  const presenceInfo = useMemo(
    () => (localUserId ? { name: localUserId } : undefined),
    [localUserId],
  );

  const {
    messages,
    sendMessage,
    invokeAgent,
    connectionStatus,
    connectionState,
    agentTyping,
    typingUsers,
    typingIntents,
    connected,
    toolThreadEvents,
    clearToolThread,
    lastAgentRun,
    historyLoaded,
    seenBy,
    loadHistory,
    loadMore,
    hasMore,
    isLoadingMore,
    sendReadReceipt,
    retryMessage,
    presenceMembers,
    subscriptionCount,
  } = useChat({
    roomId: trimmedRoomId,
    agentId,
    replay,
    replayLimit: deepLinkHistoryLimit,
    historyLimit: deepLinkHistoryLimit ?? 50,
    markReadLatest: false,
    presenceInfo,
  });

  useEffect(() => {
    if (!scrollToMessageId || !historyLoaded) return;
    const el = listRef.current?.querySelector(
      `[data-message-id="${scrollToMessageId}"]`,
    );
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scrollToMessageId, historyLoaded, messages.length]);

  useRoomDraftSync({
    client: fluxyClient,
    roomId: trimmedRoomId,
    content: draft,
    replyToId: replyToId,
    enabled: Boolean(fluxyClient?.isAuthenticated()),
    onRestore: ({ content, replyToId: restoredReply }) => {
      setDraft((prev) => (prev.trim() ? prev : content));
      if (restoredReply != null) setReplyToId(restoredReply);
    },
  });

  const streamingCount = useMemo(
    () => messages.filter((m) => m.streaming).length,
    [messages],
  );

  const messagesById = useMemo(() => {
    const map = new Map<number, (typeof messages)[number]>();
    for (const m of messages) {
      if (m.id != null) map.set(m.id, m);
    }
    return map;
  }, [messages]);

  const replyCountByParent = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of messages) {
      if (m.parentId != null) {
        counts.set(m.parentId, (counts.get(m.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [messages]);

  const replyTarget = replyToId != null ? messagesById.get(replyToId) : null;

  const displayToolEvents = useMemo(() => {
    if (toolThreadEvents.length > 0) return toolThreadEvents;
    if (latestRun?.tool_calls?.length) {
      return toolCallsToThreadEvents(latestRun.id, latestRun.tool_calls);
    }
    return [];
  }, [toolThreadEvents, latestRun]);

  const isAgentBusy = agentTyping || streamingCount > 0 || runPending;

  function showRunFeedback(run: AgentRunDisplay) {
    const parts: string[] = [];
    if (run.id) parts.push(`run ${run.id.slice(0, 8)}…`);
    if (run.latency_ms != null) parts.push(`${run.latency_ms}ms`);
    if (run.input_tokens != null || run.output_tokens != null) {
      parts.push(`tokens ${run.input_tokens ?? 0}/${run.output_tokens ?? 0}`);
    }
    if (run.status === "failed" && run.error) parts.push(run.error);
    else if (run.status === "completed") parts.push("completed");
    setRunFeedback(parts.join(" · "));
    if (runFeedbackTimerRef.current) clearTimeout(runFeedbackTimerRef.current);
    runFeedbackTimerRef.current = setTimeout(() => setRunFeedback(null), 8_000);
  }

  const fetchLatestRunForRoom = useCallback(async (): Promise<AgentRunDisplay | null> => {
    const token = adminJwt.trim();
    if (!token || !agentId) return null;
    try {
      const json = await fetchWorkerJson<{ runs?: Record<string, unknown>[] }>(
        `${WORKER_URL}/agents/${encodeURIComponent(agentId)}/runs?limit=8`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const since = pollSinceRef.current;
      // Clock-skew tolerance: server `created_at` and client `since` can differ
      // by seconds. Subtract a buffer so a run created at the invoke moment
      // isn't filtered out as "too old" on the next poll after a re-subscribe.
      const sinceWithBuffer = since
        ? new Date(new Date(since).getTime() - 60_000).toISOString()
        : null;
      for (const row of json.runs ?? []) {
        const run = normalizeAgentRun(row);
        if (run.room_id && run.room_id !== trimmedRoomId) continue;
        if (sinceWithBuffer && run.created_at && run.created_at < sinceWithBuffer) continue;
        if (run.status === "completed" || run.status === "failed") return run;
      }
      return null;
    } catch {
      return null;
    }
  }, [adminJwt, agentId, trimmedRoomId]);

  useEffect(() => {
    if (!runPending || !adminJwt.trim()) return;
    let cancelled = false;

    const tick = async () => {
      const run = await fetchLatestRunForRoom();
      if (cancelled || !run) return;
      setLatestRun(run);
      setRunPending(false);
      if (run.status === "failed") {
        setInvokeError(run.error || "Agent run failed");
      }
      showRunFeedback(run);
    };

    void tick();
    const intervalId = window.setInterval(() => void tick(), RUN_POLL_MS);
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setRunPending(false);
    }, RUN_POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [runPending, adminJwt, fetchLatestRunForRoom]);

  useEffect(() => {
    if (!lastAgentRun) return;
    if (lastAgentRun.room_id && lastAgentRun.room_id !== trimmedRoomId) return;
    const run = normalizeAgentRun(lastAgentRun as unknown as Record<string, unknown>);
    setLatestRun(run);
    setRunPending(false);
    if (run.status === "failed") {
      setInvokeError(run.error || "Agent run failed");
    }
    showRunFeedback(run);
  }, [lastAgentRun, trimmedRoomId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, agentTyping, latestRun, displayToolEvents]);

  useEffect(
    () => () => {
      if (runFeedbackTimerRef.current) clearTimeout(runFeedbackTimerRef.current);
    },
    [],
  );

  function beginRunTracking() {
    pollSinceRef.current = new Date().toISOString();
    setLatestRun(null);
    setInvokeError(null);
    clearToolThread();
    if (usesMentionInvoke && adminJwt.trim()) {
      setRunPending(true);
    }
  }

  function applyInvokeResult(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const row = payload as Record<string, unknown>;
    const runRaw = row.run ?? row;
    if (runRaw && typeof runRaw === "object") {
      setLatestRun(normalizeAgentRun(runRaw as Record<string, unknown>));
      const status = String((runRaw as Record<string, unknown>).status ?? "");
      if (status === "failed") {
        const err = (runRaw as Record<string, unknown>).error;
        setInvokeError(err != null ? String(err) : "Agent run failed");
      }
      showRunFeedback(normalizeAgentRun(runRaw as Record<string, unknown>));
    }
  }

  function messageSendOptions(
    templateSend: AgentRoomTemplateSelection | null,
  ): FluxySendMessageOptions | undefined {
    const base: FluxySendMessageOptions = {};
    if (templateSend) {
      base.templateId = templateSend.templateId;
      base.templateVars = templateSend.vars;
    }
    if (ephemeralTtlSeconds > 0) {
      base.expiresInSeconds = ephemeralTtlSeconds;
    }
    if (whisperMode && whisperTo.trim()) {
      base.visibility = "whisper";
      base.visibleTo = [whisperTo.trim()];
    }
    return Object.keys(base).length ? base : undefined;
  }

  async function executeSend(payload: PendingComposePayload) {
    const { templateSend, text, parentId } = payload;
    if (!trimmedRoomId) return;
    setInputError(null);
    beginRunTracking();
    const sendOpts = messageSendOptions(templateSend);

    try {
      if (usesMentionInvoke) {
        const mentionPayload = templateSend
          ? `${mentionPrefixForAgent(agentHandle)}${templateSend.renderedPreview}`.trim()
          : `${mentionPrefixForAgent(agentHandle)}${text}`.trim();
        await sendMessage(mentionPayload, parentId, undefined, sendOpts);
        setDraft("");
        try {
          await fluxyClient?.putRoomDraft(trimmedRoomId, { content: "", replyToId: null });
        } catch {
          /* draft sync is best-effort */
        }
        setTemplateSelection(null);
        setReplyToId(null);
        if (!adminJwt.trim()) {
          setInvokeError(
            "Admin JWT required to show run status after @mention. Paste one in Projects or use REST invoke.",
          );
        }
        return;
      }

      if (templateSend) {
        const rendered = templateSend.renderedPreview.trim();
        await sendMessage(rendered, parentId, undefined, sendOpts);
      } else {
        await sendMessage(text, parentId, undefined, sendOpts);
      }
      setDraft("");
      try {
        await fluxyClient?.putRoomDraft(trimmedRoomId, { content: "", replyToId: null });
      } catch {
        /* draft sync is best-effort */
      }
      setTemplateSelection(null);
      setReplyToId(null);
      try {
        const result = await invokeAgent(text, { replyTo: parentId });
        applyInvokeResult(result);
      } catch (err: unknown) {
        setInvokeError(messageFromUnknown(err, "Agent invoke failed"));
      }
    } catch (err: unknown) {
      setRunPending(false);
      setInputError(messageFromUnknown(err, "Failed to send message"));
    }
  }

  function requestSend() {
    const templateSend = templateSelection;
    const text = templateSend ? templateSend.renderedPreview.trim() : draft.trim();
    if (!text || !trimmedRoomId) return;

    const previewText = usesMentionInvoke
      ? templateSend
        ? `${mentionPrefixForAgent(agentHandle)}${templateSend.renderedPreview}`.trim()
        : `${mentionPrefixForAgent(agentHandle)}${text}`.trim()
      : text;

    const payload: PendingComposePayload = {
      templateSend,
      text,
      parentId: replyToId,
    };

    if (confirmBeforeSend) {
      setPendingCompose({
        previewText,
        modeLabel: usesMentionInvoke ? `@${mentionHandle} mention` : "REST invoke",
        payload,
      });
      return;
    }

    void executeSend(payload);
  }

  const canSend = Boolean(
    trimmedRoomId &&
      !isAgentBusy &&
      !pendingCompose &&
      (templateSelection?.renderedPreview.trim() || draft.trim()),
  );

  const reconnectHint = (() => {
    if (connectionState.status !== "reconnecting" || !connectionState.nextRetryAt) {
      return null;
    }
    const seconds = Math.max(
      0,
      Math.ceil(
        (new Date(connectionState.nextRetryAt).getTime() - Date.now()) / 1000,
      ),
    );
    return `Reconnecting in ${seconds}s…`;
  })();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Room <code className="font-mono">{trimmedRoomId || ""}</code>
          {usesMentionInvoke ? (
            <span className="ml-2 text-brand">· @{mentionHandle} mention invoke</span>
          ) : (
            <span className="ml-2">· REST invoke</span>
          )}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[10px]">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={skipHistoryOnConnect}
            onChange={(e) => {
              const next = e.target.checked;
              setSkipHistoryOnConnect(next);
              try {
                localStorage.setItem(SKIP_HISTORY_STORAGE_KEY, next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          />
          Skip history on connect
        </label>
        <span>
          {reconnectHint ?? connectionStatus}
          {connectionState.transport === "sse" ? " · SSE" : ""}
          {connectionState.transport === "polling" ? " · polling" : ""}
          {connected ? " · live" : ""}
          {Object.entries(typingUsers)
            .filter(([, v]) => v)
            .map(([uid]) => {
              const intent = typingIntents[uid] ?? "composing";
              return (
                <span key={uid} className="ml-2 text-brand">
                  · {uid} ({intent})
                </span>
              );
            })}
          {skipHistoryOnConnect && !historyLoaded ? (
            <button
              type="button"
              className="ml-2 text-brand underline underline-offset-2"
              onClick={() => void loadHistory()}
            >
              Load history
            </button>
          ) : null}
          {isAgentBusy ? (
            <span className="ml-2 inline-flex items-center gap-1 text-brand">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {agentName}
              {streamingCount > 0
                ? " streaming…"
                : runPending
                  ? " running…"
                  : " thinking…"}
            </span>
          ) : null}
        </span>
      </div>

      {runFeedback ? (
        <div
          className="rounded-lg border border-brand/25 bg-brand/10 px-3 py-2 text-xs text-foreground"
          role="status"
          data-testid="agent-run-feedback"
        >
          {runFeedback}
        </div>
      ) : null}

      <AgentRunStatus run={latestRun} pending={runPending} />

      <AgentHandoffBanner
        roomId={trimmedRoomId}
        agentId={agentId}
        agentName={agentName}
        operatorJwt={adminJwt}
      />

      <ChatPresenceStrip
        members={presenceMembers}
        subscriptionCount={subscriptionCount}
      />

      <ChatCatchUpBanner
        client={fluxyClient}
        roomId={trimmedRoomId}
        messages={messages}
        listRef={listRef}
        loadMore={loadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onMarkRead={sendReadReceipt}
      />

      <div
        ref={listRef}
        className="flex h-[min(420px,50vh)] flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3"
        data-testid="agent-room-message-list"
      >
        {messages.length ? (
          messages.map((m) => (
            <AgentRoomMessage
              key={m.id}
              message={m}
              onRetry={
                m.clientMessageId
                  ? (clientMessageId) => retryMessage(clientMessageId)
                  : undefined
              }
              agentId={agentId}
              localUserId={localUserId}
              roomId={trimmedRoomId}
              replyCount={m.id != null ? replyCountByParent.get(m.id) ?? 0 : 0}
              parentMessage={
                m.parentId != null ? messagesById.get(m.parentId) ?? null : null
              }
              onReply={(id) => setReplyToId(id)}
              seenBy={m.id != null ? seenBy?.[m.id] : undefined}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask {agentName} — replies stream over WebSocket; tool calls appear inline when
            the agent uses tools.
          </p>
        )}
        {displayToolEvents.map((ev) => (
          <AgentToolThreadCard key={ev.key} event={ev} />
        ))}
        {runPending && displayToolEvents.length === 0 ? (
          <p className="mx-6 text-xs text-muted-foreground">Waiting for tool rounds…</p>
        ) : null}
      </div>

      {replyToId != null ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs"
          data-testid="reply-compose-banner"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium text-brand">Replying to</span>{" "}
            <span className="text-muted-foreground">
              {replyTarget
                ? `${displayUserId(replyTarget)}: ${(replyTarget.content || "").slice(0, 80)}`
                : `#${replyToId}`}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => setReplyToId(null)}
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <AgentRoomTemplatePicker
        adminJwt={adminJwt}
        disabled={!trimmedRoomId || isAgentBusy}
        value={templateSelection}
        onChange={setTemplateSelection}
      />

      {pendingCompose ? (
        <AgentCopilotConfirm
          previewText={pendingCompose.previewText}
          modeLabel={pendingCompose.modeLabel}
          busy={isAgentBusy}
          onEdit={() => setPendingCompose(null)}
          onConfirm={() => {
            const payload = pendingCompose.payload;
            setPendingCompose(null);
            void executeSend(payload);
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={confirmBeforeSend}
            onChange={(e) => setConfirmBeforeSend(e.target.checked)}
            disabled={Boolean(pendingCompose)}
          />
          Confirm before send
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-border"
            checked={whisperMode}
            onChange={(e) => setWhisperMode(e.target.checked)}
          />
          Whisper to
          <Input
            value={whisperTo}
            onChange={(e) => setWhisperTo(e.target.value)}
            placeholder="user id"
            className="h-7 w-28 px-1.5 text-xs"
            disabled={!whisperMode}
          />
        </label>
        <label className="flex items-center gap-1.5">
          Ephemeral
          <select
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
            value={ephemeralTtlSeconds}
            onChange={(e) => setEphemeralTtlSeconds(Number(e.target.value))}
            disabled={isAgentBusy}
          >
            <option value={0}>Off</option>
            <option value={3600}>1 hour</option>
            <option value={86400}>24 hours</option>
          </select>
        </label>
      </div>

      {!draft.trim() && messages.length > 0 && trimmedRoomId && !isAgentBusy ? (
        <ReplySuggestions
          roomId={trimmedRoomId}
          parentId={replyToId}
          onSelect={(s) => {
            setDraft(s);
            setReplyToId(null);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            templateSelection
              ? "Optional note (template message will be sent)"
              : usesMentionInvoke
                ? `Message @${mentionHandle}…`
                : `Ask ${agentName}…`
          }
          disabled={!trimmedRoomId || isAgentBusy || Boolean(templateSelection)}
          className="sm:flex-1"
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            if (!canSend) return;
            void requestSend();
          }}
        />
        <div className="flex items-end gap-1.5">
          <VoiceRecorder
            disabled={!trimmedRoomId || isAgentBusy || Boolean(templateSelection)}
            onSend={async (audio, durationMs) => {
              if (!fluxyClient || !trimmedRoomId) return;
              setInputError(null);
              try {
                const sent = await fluxyClient.sendVoiceMessage(trimmedRoomId, audio, {
                  durationMs,
                  parentId: replyToId,
                });
                if (!sent) {
                  setInputError("Voice message not sent — check authentication.");
                  return;
                }
                void loadHistory();
                setReplyToId(null);
                try {
                  await fluxyClient?.putRoomDraft(trimmedRoomId, {
                    content: "",
                    replyToId: null,
                  });
                } catch {
                  /* draft sync is best-effort */
                }
              } catch (err: unknown) {
                setInputError(
                  err instanceof Error ? err.message : "Failed to send voice message",
                );
              }
            }}
          />
          <Button
            variant="primary"
            onClick={() => requestSend()}
            disabled={!canSend}
          >
            {isAgentBusy ? "Waiting…" : "Send"}
          </Button>
        </div>
      </div>

      {inputError ? (
        <p className="text-xs text-red-600" role="alert">
          {inputError}
        </p>
      ) : null}
      {invokeError ? (
        <p className="text-xs text-amber-800" role="alert">
          {invokeError}
        </p>
      ) : null}

      {memberJwt.trim() && trimmedRoomId ? (
        <RoomOfflineNotifySettings
          compact
          roomId={trimmedRoomId}
          memberJwt={memberJwt}
          memberUserId={memberUserId}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        {usesMentionInvoke
          ? "Sends @mention; tools stream in-thread over WebSocket. Run banner polls every 2s (admin JWT)."
          : "REST invoke: tools stream live when connected; run summary in the banner above."}{" "}
        Set <code className="text-xs">toolExecuteUrl</code> on the agent profile for tool rounds.{" "}
        See <code className="text-xs">docs/cookbook/bot-streaming-fluxy-message-stream.md</code> for
        custom Node bots.
      </p>
    </div>
  );
}

