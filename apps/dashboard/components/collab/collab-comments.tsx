"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, MessageSquare, Send, ThumbsUp, Trash2 } from "lucide-react";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();
const REACTION = "👍";

interface Comment {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  reactions: Record<string, string[]>;
}

interface Thread {
  id: string;
  roomId: string;
  createdBy: string;
  resolved: boolean;
  metadata: { quote?: string; x?: number; y?: number };
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
}

/** Contextual comments on `POST/GET /rooms/:id/comment-threads` (Liveblocks Threads analogue). */
export default function CollabComments({ roomId }: { roomId: string }) {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (!token) return null;
      try {
        const res = await fetch(
          `${WORKER_URL}/rooms/${encodeURIComponent(roomId)}/comment-threads${path}`,
          {
            ...init,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              ...(init.headers || {}),
            },
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(String(data.error || `http_${res.status}`));
          return null;
        }
        setError(null);
        return data;
      } catch {
        setError("network_error");
        return null;
      }
    },
    [roomId, token],
  );

  const loadThreads = useCallback(async () => {
    const data = await request("");
    if (data) setThreads(data.threads || []);
    setLoading(false);
  }, [request]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const createThread = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const data = await request("", { method: "POST", body: JSON.stringify({ body }) });
    if (data?.thread) {
      setThreads((prev) => [...prev, data.thread]);
      setDraft("");
    }
    setBusy(false);
  };

  const reply = async (thread: Thread) => {
    const body = (replyDrafts[thread.id] || "").trim();
    if (!body || busy) return;
    setBusy(true);
    const data = await request(`/${thread.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    if (data?.comment) {
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, comments: [...t.comments, data.comment] } : t)),
      );
      setReplyDrafts((prev) => ({ ...prev, [thread.id]: "" }));
    }
    setBusy(false);
  };

  const toggleResolve = async (thread: Thread) => {
    const data = await request(`/${thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({ resolved: !thread.resolved }),
    });
    if (data?.ok) {
      setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, resolved: !t.resolved } : t)));
    }
  };

  const removeThread = async (thread: Thread) => {
    const data = await request(`/${thread.id}`, { method: "DELETE" });
    if (data?.ok) setThreads((prev) => prev.filter((t) => t.id !== thread.id));
  };

  const removeComment = async (thread: Thread, comment: Comment) => {
    const data = await request(`/${thread.id}/comments/${comment.id}`, { method: "DELETE" });
    if (data?.ok) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id ? { ...t, comments: t.comments.filter((c) => c.id !== comment.id) } : t,
        ),
      );
    }
  };

  const toggleReaction = async (thread: Thread, comment: Comment) => {
    const reacted = (comment.reactions[REACTION] || []).length > 0;
    const data = await request(`/${thread.id}/comments/${comment.id}/reactions`, {
      method: reacted ? "DELETE" : "POST",
      body: JSON.stringify({ emoji: REACTION }),
    });
    if (data?.comment) {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id
            ? { ...t, comments: t.comments.map((c) => (c.id === comment.id ? data.comment : c)) }
            : t,
        ),
      );
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground">
          {threads.length} thread{threads.length !== 1 ? "s" : ""}
        </h3>
        {error && <span className="ml-auto text-[10px] text-red-500">{error}</span>}
      </div>

      <div className="flex items-center gap-2 border-b px-4 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createThread()}
          placeholder="Start a thread..."
          className="flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={createThread}
          disabled={busy || !draft.trim()}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Post
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="py-8 text-center text-xs text-muted-foreground">Loading threads...</p>}
        {!loading && threads.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No threads yet. Post one to start a conversation on this workspace.
          </p>
        )}
        <div className="space-y-3">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={cn(
                "rounded-xl border p-3",
                thread.resolved && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
              )}
            >
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-medium">{thread.createdBy}</span>
                <span>{new Date(thread.createdAt).toLocaleString()}</span>
                {thread.resolved && <span className="text-green-600">Resolved</span>}
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    onClick={() => toggleResolve(thread)}
                    className={cn("rounded-md p-1 hover:bg-muted", thread.resolved && "text-green-600")}
                    title={thread.resolved ? "Reopen thread" : "Resolve thread"}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeThread(thread)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {thread.comments.map((comment) => (
                  <div key={comment.id} className="group flex items-start gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                      {(comment.userId || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed">{comment.body}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{comment.userId}</span>
                        <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                        {comment.editedAt && <span>(edited)</span>}
                        <button
                          onClick={() => toggleReaction(thread, comment)}
                          className={cn(
                            "flex items-center gap-0.5 rounded-md px-1 hover:bg-muted",
                            (comment.reactions[REACTION] || []).length > 0 && "text-indigo-600",
                          )}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {(comment.reactions[REACTION] || []).length || ""}
                        </button>
                        <button
                          onClick={() => removeComment(thread, comment)}
                          className="rounded-md p-0.5 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          title="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  value={replyDrafts[thread.id] || ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && reply(thread)}
                  placeholder="Reply..."
                  className="flex-1 rounded-lg border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  onClick={() => reply(thread)}
                  disabled={busy || !(replyDrafts[thread.id] || "").trim()}
                  className="rounded-lg border px-2 py-1 text-[10px] font-medium hover:bg-muted disabled:opacity-50"
                >
                  Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
