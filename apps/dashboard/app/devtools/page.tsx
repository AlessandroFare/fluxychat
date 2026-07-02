"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Loader2,
  Terminal,
  Wrench,
  XCircle,
  Code2,
  MessageSquare,
  User as UserIcon,
  Play,
  Boxes,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Composer, ComposerTextarea, ComposerToolbar, ComposerToolbarLeft, ComposerToolbarRight, ComposerSubmitButton } from "@/components/ui/composer";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { useDashboardSession } from "../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface StreamEvent {
  id: string;
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

interface ToolCallEntry {
  id: string;
  name: string;
  status: "pending" | "approved" | "denied" | "executing" | "done" | "error";
  args?: Record<string, unknown>;
  result?: unknown;
  needsApproval: boolean;
}

interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const PRESET_PROMPTS: readonly { label: string; prompt: string }[] = [
  { label: "Summarize a topic", prompt: "Give me a brief summary of how WebSockets work." },
  { label: "Write code", prompt: "Write a TypeScript function that debounces an async call." },
  { label: "Tool call demo", prompt: "Search the web for 'AI news today' and summarize the top result." },
  { label: "Creative writing", prompt: "Write a short poem about edge computing." },
];

/* -------------------------------------------------------------------------- */
/*  Chat API types                                                            */
/* -------------------------------------------------------------------------- */

type ChatApiMethod = "thread" | "openDM" | "getUser";

interface ChatApiResponse {
  method: ChatApiMethod;
  status: "loading" | "success" | "error";
  data?: unknown;
  error?: string;
  durationMs?: number;
}

const CHAT_API_METHODS: {
  id: ChatApiMethod;
  label: string;
  signature: string;
  description: string;
  icon: typeof MessageSquare;
  placeholder: string;
  paramLabel: string;
}[] = [
  {
    id: "thread",
    label: "chat.thread()",
    signature: "chat.thread(roomId: string, limit?: number)",
    description: "Fetch the message thread for a room. Returns recent messages in chronological order.",
    icon: MessageSquare,
    placeholder: "room_abc123",
    paramLabel: "Room ID",
  },
  {
    id: "openDM",
    label: "chat.openDM()",
    signature: "chat.openDM(userId: string)",
    description: "Open (or create) a direct message room with the given user. Returns the DM room info.",
    icon: UserIcon,
    placeholder: "usr_xyz789",
    paramLabel: "User ID",
  },
  {
    id: "getUser",
    label: "chat.getUser()",
    signature: "chat.getUser(userId: string)",
    description: "Look up a user by ID. Returns profile, presence, and role information.",
    icon: UserIcon,
    placeholder: "usr_xyz789",
    paramLabel: "User ID",
  },
];

/* -------------------------------------------------------------------------- */
/*  PostableObject types                                                      */
/* -------------------------------------------------------------------------- */

type PostableType = "text" | "card" | "image" | "file" | "system";

const POSTABLE_TYPES: {
  type: PostableType;
  label: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; required: boolean }[];
}[] = [
  {
    type: "text",
    label: "Text Message",
    description: "A plain text or markdown message.",
    fields: [
      { key: "content", label: "Content", placeholder: "Hello, world!", required: true },
      { key: "roomId", label: "Room ID", placeholder: "room_abc123", required: true },
    ],
  },
  {
    type: "card",
    label: "Card",
    description: "An interactive card with title and children elements.",
    fields: [
      { key: "title", label: "Title", placeholder: "My Card", required: true },
      { key: "content", label: "Text content", placeholder: "Card body text", required: true },
      { key: "roomId", label: "Room ID", placeholder: "room_abc123", required: true },
    ],
  },
  {
    type: "image",
    label: "Image",
    description: "An image attachment with optional caption.",
    fields: [
      { key: "url", label: "Image URL", placeholder: "https://example.com/image.png", required: true },
      { key: "caption", label: "Caption", placeholder: "Check this out!", required: false },
      { key: "roomId", label: "Room ID", placeholder: "room_abc123", required: true },
    ],
  },
  {
    type: "file",
    label: "File",
    description: "A file attachment with metadata.",
    fields: [
      { key: "url", label: "File URL", placeholder: "https://example.com/doc.pdf", required: true },
      { key: "filename", label: "Filename", placeholder: "document.pdf", required: true },
      { key: "roomId", label: "Room ID", placeholder: "room_abc123", required: true },
    ],
  },
  {
    type: "system",
    label: "System Message",
    description: "A system-level notification (join, leave, etc.).",
    fields: [
      { key: "event", label: "Event type", placeholder: "user_joined | user_left | room_created", required: true },
      { key: "roomId", label: "Room ID", placeholder: "room_abc123", required: true },
    ],
  },
];

const POSTABLE_INTERFACE = `interface PostableObject {
  type: "text" | "card" | "image" | "file" | "system";
  roomId: string;
  // text
  content?: string;
  // card
  card?: {
    title?: string;
    children: CardChild[];
  };
  // image
  url?: string;
  caption?: string;
  // file
  filename?: string;
  // system
  event?: "user_joined" | "user_left" | "room_created";
}`;

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function DevToolsPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const workerUrl = getPublicWorkerUrl();

  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [renderedText, setRenderedText] = useState("");
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawEvents, setShowRawEvents] = useState(true);

   // Chat API state
  const [chatApiMethod, setChatApiMethod] = useState<ChatApiMethod>("thread");
  const [chatApiParam, setChatApiParam] = useState("");
  const [chatApiResponse, setChatApiResponse] = useState<ChatApiResponse | null>(null);
  const [chatApiLoading, setChatApiLoading] = useState(false);

  // PostableObject state
  const [postableType, setPostableType] = useState<PostableType>("text");
  const [postableFields, setPostableFields] = useState<Record<string, string>>({});
  const [postableResponse, setPostableResponse] = useState<{ status: "idle" | "loading" | "success" | "error"; data?: unknown; error?: string }>({ status: "idle" });

  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef("");
  const eventCounter = useRef(0);

  const authHeader = useMemo(() => {
    const token = adminJwt.trim() || memberJwt.trim();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [adminJwt, memberJwt]);

  const resetState = useCallback(() => {
    setEvents([]);
    setToolCalls([]);
    setRenderedText("");
    setTokenStats(null);
    setError(null);
    bufferRef.current = "";
    eventCounter.current = 0;
  }, []);

  const addEvent = useCallback((type: string, data: Record<string, unknown>) => {
    eventCounter.current += 1;
    setEvents((prev) => [
      ...prev,
      { id: `evt-${eventCounter.current}`, timestamp: Date.now(), type, data },
    ]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      resetState();
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      addEvent("user_message", { text });

      try {
        const res = await fetch(`${workerUrl}/api/devtools/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ?? {}),
          },
          body: JSON.stringify({ message: text, stream: true }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const chunk = JSON.parse(raw);
              addEvent(chunk.type ?? "unknown", chunk);

              if (chunk.type === "text" && chunk.text) {
                bufferRef.current += chunk.text;
                setRenderedText(bufferRef.current);
              } else if (chunk.type === "tool_call_start") {
                setToolCalls((prev) => [
                  ...prev,
                  {
                    id: chunk.toolCallId,
                    name: chunk.toolName ?? "unknown",
                    status: chunk.needsApproval ? "pending" : "executing",
                    needsApproval: !!chunk.needsApproval,
                  },
                ]);
              } else if (chunk.type === "tool_call_complete") {
                setToolCalls((prev) =>
                  prev.map((tc) =>
                    tc.id === chunk.toolCallId
                      ? { ...tc, status: "done", args: chunk.args, result: chunk.result }
                      : tc,
                  ),
                );
              } else if (chunk.type === "tool_call_error") {
                setToolCalls((prev) =>
                  prev.map((tc) =>
                    tc.id === chunk.toolCallId
                      ? { ...tc, status: "error" }
                      : tc,
                  ),
                );
              } else if (chunk.type === "usage" && chunk.usage) {
                setTokenStats({
                  promptTokens: chunk.usage.promptTokens ?? 0,
                  completionTokens: chunk.usage.completionTokens ?? 0,
                  totalTokens: chunk.usage.totalTokens ?? 0,
                });
              } else if (chunk.type === "error") {
                setError(chunk.error ?? "Unknown stream error");
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        addEvent("stream_end", {});
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") {
          addEvent("aborted", {});
        } else {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, resetState, addEvent, workerUrl, authHeader],
  );

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const callChatApi = useCallback(
    async (method: ChatApiMethod, param: string) => {
      if (!param.trim()) return;
      setChatApiLoading(true);
      setChatApiResponse({ method, status: "loading" });
      const start = Date.now();
      try {
        const endpoint =
          method === "thread"
            ? `/api/chat/thread/${encodeURIComponent(param)}`
            : method === "openDM"
              ? `/api/chat/dm/${encodeURIComponent(param)}`
              : `/api/chat/user/${encodeURIComponent(param)}`;
        const res = await fetch(`${workerUrl}${endpoint}`, { headers: authHeader });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setChatApiResponse({ method, status: "success", data, durationMs: Date.now() - start });
      } catch (err) {
        setChatApiResponse({
          method,
          status: "error",
          error: err instanceof Error ? err.message : "Request failed",
          durationMs: Date.now() - start,
        });
      } finally {
        setChatApiLoading(false);
      }
    },
    [workerUrl, authHeader],
  );

  const postObject = useCallback(
    async (type: PostableType, fields: Record<string, string>) => {
      setPostableResponse({ status: "loading" });
      try {
        const body: Record<string, unknown> = { type, roomId: fields.roomId };
        if (fields.content) body.content = fields.content;
        if (fields.title) body.card = { title: fields.title, children: [{ type: "text", content: fields.content }] };
        if (fields.url) body.url = fields.url;
        if (fields.caption) body.caption = fields.caption;
        if (fields.filename) body.filename = fields.filename;
        if (fields.event) body.event = fields.event;

        const res = await fetch(`${workerUrl}/api/chat/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setPostableResponse({ status: "success", data });
      } catch (err) {
        setPostableResponse({
          status: "error",
          error: err instanceof Error ? err.message : "Post failed",
        });
      }
    },
    [workerUrl, authHeader],
  );

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="DevTools Playground"
        description={
          <>
            Send a message to an AI agent and inspect the streaming response, tool calls, and token
            usage in real time.{" "}
            <Link href="/guides/agent-events-same-websocket-stream" className="text-brand underline underline-offset-2">
              Learn more →
            </Link>
          </>
        }
      />

      {/* Preset prompts */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Try it</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              disabled={streaming}
              onClick={() => {
                setDraft(preset.prompt);
                void sendMessage(preset.prompt);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat input */}
      <Composer
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          void sendMessage(text);
          setDraft("");
        }}
      >
        <ComposerTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a message to the agent…"
          disabled={streaming}
        />
        <ComposerToolbar>
          <ComposerToolbarLeft>
            {streaming ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => abortRef.current?.abort()}
              >
                Stop
              </Button>
            ) : null}
          </ComposerToolbarLeft>
          <ComposerToolbarRight>
            <ComposerSubmitButton disabled={streaming || !draft.trim()} loading={streaming} />
          </ComposerToolbarRight>
        </ComposerToolbar>
      </Composer>

      <TypingIndicator visible={streaming} name="Agent" className="mb-2" />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Main grid: response + side panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left: rendered response + tool calls */}
        <div className="min-w-0 space-y-4">
          {/* Streaming markdown response */}
          <Panel title="Agent response" className="min-h-[200px]">
            {renderedText ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {renderedText}
                {streaming ? (
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {streaming ? "Waiting for response…" : "Send a message to see the streaming response here."}
              </p>
            )}
          </Panel>

          {/* Tool calls */}
          {toolCalls.length > 0 ? (
            <Panel title="Tool calls">
              <div className="space-y-3">
                {toolCalls.map((tc) => (
                  <div
                    key={tc.id}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm font-medium">{tc.name}</span>
                      <ToolCallStatusBadge status={tc.status} />
                    </div>
                    {tc.args ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
                        {JSON.stringify(tc.args, null, 2)}
                      </pre>
                    ) : null}
                    {tc.needsApproval && tc.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost">
                          <XCircle className="mr-1 h-3 w-3" /> Deny
                        </Button>
                      </div>
                    ) : null}
                    {tc.result !== undefined ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                        {JSON.stringify(tc.result, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {/* Token stats */}
          {tokenStats ? (
            <Panel title="Token usage">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TokenStat icon={Terminal} label="Prompt" value={tokenStats.promptTokens} />
                <TokenStat icon={Cpu} label="Completion" value={tokenStats.completionTokens} />
                <TokenStat icon={Activity} label="Total" value={tokenStats.totalTokens} />
              </div>
            </Panel>
          ) : null}
        </div>

        {/* Right: raw SSE events */}
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Raw stream events</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawEvents((v) => !v)}
            >
              {showRawEvents ? "Hide" : "Show"}
            </Button>
          </div>
          {showRawEvents ? (
            <div className="max-h-[600px] overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-slate-950 p-3">
              {events.length === 0 ? (
                <p className="text-xs text-slate-500">No events yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {events.map((evt) => (
                    <div key={evt.id} className="font-mono text-xs">
                      <span className="text-slate-500">
                        {new Date(evt.timestamp).toLocaleTimeString(undefined, {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>{" "}
                      <span className="font-semibold text-blue-400">{evt.type}</span>
                      <pre className="mt-0.5 overflow-x-auto text-slate-400">
                        {JSON.stringify(evt.data, null, 0)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {/* Chat API Explorer */}
      <div className="mt-8">
        <Panel title="Chat API Explorer">
          <p className="mb-4 text-sm text-muted-foreground">
            Try the FluxyChat Chat API methods interactively. Enter a parameter and call the method to see the JSON response.
          </p>

          {/* Method tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {CHAT_API_METHODS.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setChatApiMethod(m.id);
                    setChatApiResponse(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    chatApiMethod === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Active method info */}
          {CHAT_API_METHODS.filter((m) => m.id === chatApiMethod).map((m) => (
            <div key={m.id} className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <code className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {m.signature}
                </code>
                <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
              </div>

              {/* Input + call */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={chatApiParam}
                  onChange={(e) => setChatApiParam(e.target.value)}
                  placeholder={m.placeholder}
                  disabled={chatApiLoading}
                  className="flex-1"
                />
                <Button
                  onClick={() => void callChatApi(m.id, chatApiParam)}
                  disabled={chatApiLoading || !chatApiParam.trim()}
                >
                  {chatApiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Call
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{m.paramLabel}</p>

              {/* Response */}
              {chatApiResponse ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {chatApiResponse.status === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                    ) : chatApiResponse.status === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                    )}
                    <span className="text-xs font-medium text-foreground">
                      {chatApiResponse.status === "loading"
                        ? "Loading…"
                        : chatApiResponse.status === "success"
                          ? `Success${chatApiResponse.durationMs ? ` · ${chatApiResponse.durationMs}ms` : ""}`
                          : "Error"}
                    </span>
                  </div>
                  {chatApiResponse.status === "error" && chatApiResponse.error ? (
                    <pre className="overflow-x-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {chatApiResponse.error}
                    </pre>
                  ) : chatApiResponse.data !== undefined ? (
                    <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                      {JSON.stringify(chatApiResponse.data, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </Panel>
      </div>

      {/* PostableObject Explorer */}
      <div className="mt-8">
        <Panel title="PostableObject Explorer">
          <p className="mb-4 text-sm text-muted-foreground">
            The <code className="font-mono text-xs">PostableObject</code> interface defines what can be sent to a room.
            Pick a type, fill in the fields, and post it.
          </p>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Left: type picker + fields + interface */}
            <div className="min-w-0 space-y-4">
              {/* Interface definition */}
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Interface definition</span>
                </div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                  {POSTABLE_INTERFACE}
                </pre>
              </div>

              {/* Type selector */}
              <div>
                <span className="mb-2 block text-xs font-semibold text-foreground">Object type</span>
                <div className="flex flex-wrap gap-2">
                  {POSTABLE_TYPES.map((pt) => (
                    <button
                      key={pt.type}
                      onClick={() => {
                        setPostableType(pt.type);
                        setPostableFields({});
                        setPostableResponse({ status: "idle" });
                      }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        postableType === pt.type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              {POSTABLE_TYPES.filter((pt) => pt.type === postableType).map((pt) => (
                <div key={pt.type} className="space-y-2">
                  <p className="text-xs text-muted-foreground">{pt.description}</p>
                  {pt.fields.map((field) => (
                    <div key={field.key}>
                      <label className="mb-0.5 block text-xs font-medium text-muted-foreground">
                        {field.label}
                        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                      </label>
                      <Input
                        value={postableFields[field.key] ?? ""}
                        onChange={(e) =>
                          setPostableFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                  <Button
                    onClick={() => void postObject(postableType, postableFields)}
                    disabled={
                      postableResponse.status === "loading" ||
                      !POSTABLE_TYPES.find((pt) => pt.type === postableType)?.fields
                        .filter((f) => f.required)
                        .every((f) => postableFields[f.key]?.trim())
                    }
                  >
                    {postableResponse.status === "loading" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Boxes className="h-3.5 w-3.5" />
                    )}
                    Post object
                  </Button>
                </div>
              ))}
            </div>

            {/* Right: preview + response */}
            <div className="min-w-0 space-y-4">
              {/* JSON preview */}
              <div>
                <span className="mb-1 block text-xs font-semibold text-foreground">JSON preview</span>
                <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                  {JSON.stringify(
                    (() => {
                      const base: Record<string, unknown> = { type: postableType };
                      if (postableFields.roomId) base.roomId = postableFields.roomId;
                      if (postableFields.content) base.content = postableFields.content;
                      if (postableFields.title) base.card = { title: postableFields.title, children: [{ type: "text", content: postableFields.content }] };
                      if (postableFields.url) base.url = postableFields.url;
                      if (postableFields.caption) base.caption = postableFields.caption;
                      if (postableFields.filename) base.filename = postableFields.filename;
                      if (postableFields.event) base.event = postableFields.event;
                      return base;
                    })(),
                    null,
                    2,
                  )}
                </pre>
              </div>

              {/* Post response */}
              <div>
                <span className="mb-1 block text-xs font-semibold text-foreground">Response</span>
                {postableResponse.status === "idle" ? (
                  <p className="text-xs text-muted-foreground">Fill in the fields and click "Post object".</p>
                ) : postableResponse.status === "loading" ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Posting…
                  </div>
                ) : postableResponse.status === "success" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">Posted successfully</span>
                    </div>
                    <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                      {JSON.stringify(postableResponse.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                      <span className="text-xs font-medium text-red-700">Post failed</span>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {postableResponse.error}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </ConsoleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function ToolCallStatusBadge({ status }: { status: ToolCallEntry["status"] }) {
  const config: Record<string, { label: string; className: string; icon?: typeof Clock }> = {
    pending: { label: "Pending", className: "bg-amber-100 text-amber-800", icon: Clock },
    approved: { label: "Approved", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
    denied: { label: "Denied", className: "bg-red-100 text-red-800", icon: XCircle },
    executing: { label: "Running", className: "bg-blue-100 text-blue-800", icon: Loader2 },
    done: { label: "Done", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
    error: { label: "Error", className: "bg-red-100 text-red-800", icon: XCircle },
  };
  const c = config[status] ?? config.pending;
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        c.className,
      )}
    >
      {Icon ? <Icon className={cn("h-3 w-3", status === "executing" && "animate-spin")} /> : null}
      {c.label}
    </span>
  );
}

function TokenStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-3">
      <Icon className="mb-1 h-4 w-4 text-muted-foreground" />
      <span className="text-lg font-bold text-foreground">{value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
