"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useChat } from "@fluxy-chat/sdk";
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
import { AgentRunStatus } from "./agent-run-status";
import { Button, Input } from "./ui";
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
  className?: string;
}

export function AgentRoomChat({
  roomId,
  agentId,
  agentName,
  agentHandle,
  adminJwt = "",
  className,
}: AgentRoomChatProps) {
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<AgentRunDisplay | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);
  const [skipHistoryOnConnect, setSkipHistoryOnConnect] = useState(false);
  const pollSinceRef = useRef<string | null>(null);
  const runFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { user: clerkUser } = useClerkUser();

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

  const replay: UseChatHistoryReplay = skipHistoryOnConnect ? "request" : "connect";

  const {
    messages,
    sendMessage,
    invokeAgent,
    connectionStatus,
    agentTyping,
    connected,
    toolThreadEvents,
    clearToolThread,
    lastAgentRun,
    historyLoaded,
    loadHistory,
  } = useChat({
    roomId: trimmedRoomId,
    agentId,
    replay,
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
      for (const row of json.runs ?? []) {
        const run = normalizeAgentRun(row);
        if (run.room_id && run.room_id !== trimmedRoomId) continue;
        if (since && run.created_at && run.created_at < since) continue;
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

  async function askAgent() {
    const text = draft.trim();
    if (!text || !trimmedRoomId) return;
    setInputError(null);
    beginRunTracking();
    const parentId = replyToId;

    try {
      if (usesMentionInvoke) {
        const payload = `${mentionPrefixForAgent(agentHandle)}${text}`.trim();
        await sendMessage(payload, parentId);
        setDraft("");
        setReplyToId(null);
        if (!adminJwt.trim()) {
          setInvokeError(
            "Admin JWT required to show run status after @mention. Paste one in Projects or use REST invoke.",
          );
        }
        return;
      }

      await sendMessage(text, parentId);
      setDraft("");
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

  const canSend = Boolean(trimmedRoomId && draft.trim() && !isAgentBusy);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Room <code className="font-mono">{trimmedRoomId || "—"}</code>
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
          {connectionStatus}
          {connected ? " · live" : ""}
          {skipHistoryOnConnect && !historyLoaded ? (
            <button
              type="button"
              className="ml-2 text-brand hover:underline"
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
              agentId={agentId}
              localUserId={localUserId}
              parentMessage={
                m.parentId != null ? messagesById.get(m.parentId) ?? null : null
              }
              onReply={(id) => setReplyToId(id)}
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            usesMentionInvoke
              ? `Message @${mentionHandle}…`
              : `Ask ${agentName}…`
          }
          disabled={!trimmedRoomId || isAgentBusy}
          className="sm:flex-1"
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            if (!canSend) return;
            void askAgent();
          }}
        />
        <Button
          variant="primary"
          onClick={() => void askAgent()}
          disabled={!canSend}
        >
          {isAgentBusy ? "Waiting…" : "Send"}
        </Button>
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
