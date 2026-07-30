"use client";

import { useMemo, useState } from "react";

type PlaygroundAction = "sendMessage" | "getInbox" | "markRead";

const ACTION_LABELS: Record<PlaygroundAction, string> = {
  sendMessage: "POST /messages — send a message",
  getInbox: "GET /inbox — fetch inbox summary",
  markRead: "POST /rooms/:id/read — mark room read",
};

function buildSnippet(options: {
  action: PlaygroundAction;
  workerUrl: string;
  roomId: string;
  userId: string;
  content: string;
  messageId: number;
}): string {
  const base = options.workerUrl.replace(/\/$/, "") || "https://api.example.com";
  const clientInit = `import { FluxyChatClient } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  baseUrl: "${base}",
  userId: "${options.userId || "demo-user"}",
  token: process.env.FLUXY_MEMBER_JWT!, // mint via POST /auth/token
});`;

  if (options.action === "sendMessage") {
    return `${clientInit}

await client.createMessage("${options.roomId || "general"}", ${JSON.stringify(options.content || "Hello from the playground")});`;
  }

  if (options.action === "getInbox") {
    return `${clientInit}

const inbox = await client.getInbox();
console.log(inbox.counts, inbox.unreadRooms);`;
  }

  return `${clientInit}

await client.markReadRest("${options.roomId || "general"}", ${options.messageId || 1});`;
}

function buildCurl(options: {
  action: PlaygroundAction;
  workerUrl: string;
  roomId: string;
  content: string;
  messageId: number;
}): string {
  const base = options.workerUrl.replace(/\/$/, "") || "https://api.example.com";
  const token = "$FLUXY_MEMBER_JWT";

  if (options.action === "sendMessage") {
    return `curl -sS -X POST "${base}/messages" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    roomId: options.roomId || "general",
    content: options.content || "Hello from the playground",
  })}'`;
  }

  if (options.action === "getInbox") {
    return `curl -sS "${base}/inbox" \\
  -H "Authorization: Bearer ${token}"`;
  }

  return `curl -sS -X POST "${base}/rooms/${encodeURIComponent(options.roomId || "general")}/read" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"messageId": ${options.messageId || 1}}'`;
}

export function PlaygroundClient() {
  const [action, setAction] = useState<PlaygroundAction>("sendMessage");
  const [workerUrl, setWorkerUrl] = useState("http://127.0.0.1:8787");
  const [roomId, setRoomId] = useState("dev-local-general");
  const [userId, setUserId] = useState("demo-user");
  const [content, setContent] = useState("Hello from the docs playground");
  const [messageId, setMessageId] = useState(1);
  const [copied, setCopied] = useState<"sdk" | "curl" | null>(null);

  const snippet = useMemo(
    () => buildSnippet({ action, workerUrl, roomId, userId, content, messageId }),
    [action, workerUrl, roomId, userId, content, messageId],
  );

  const curl = useMemo(
    () => buildCurl({ action, workerUrl, roomId, content, messageId }),
    [action, workerUrl, roomId, content, messageId],
  );

  async function copy(text: string, kind: "sdk" | "curl") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SDK API playground</h1>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          Generate copy-paste SDK and curl snippets without setting up a project. Point at your Worker,
          mint a JWT with{" "}
          <code className="rounded bg-fd-muted px-1 py-0.5 text-xs">pnpm first-message</code>, then run
          locally.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Worker URL</span>
          <input
            className="w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2"
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value)}
            placeholder="http://127.0.0.1:8787"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Room id</span>
          <input
            className="w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">User id</span>
          <input
            className="w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Action</span>
          <select
            className="w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2"
            value={action}
            onChange={(e) => setAction(e.target.value as PlaygroundAction)}
          >
            {(Object.keys(ACTION_LABELS) as PlaygroundAction[]).map((key) => (
              <option key={key} value={key}>
                {ACTION_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {action === "sendMessage" ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Message content</span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
      ) : null}

      {action === "markRead" ? (
        <label className="block text-sm sm:max-w-xs">
          <span className="mb-1 block font-medium">Message id</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2"
            value={messageId}
            onChange={(e) => setMessageId(Number(e.target.value) || 1)}
          />
        </label>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">TypeScript SDK</h2>
          <button
            type="button"
            className="rounded-md border border-fd-border px-2 py-1 text-xs font-medium hover:bg-fd-muted"
            onClick={() => void copy(snippet, "sdk")}
          >
            {copied === "sdk" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-fd-border bg-fd-muted/40 p-4 text-xs leading-relaxed">
          <code>{snippet}</code>
        </pre>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">curl</h2>
          <button
            type="button"
            className="rounded-md border border-fd-border px-2 py-1 text-xs font-medium hover:bg-fd-muted"
            onClick={() => void copy(curl, "curl")}
          >
            {copied === "curl" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-fd-border bg-fd-muted/40 p-4 text-xs leading-relaxed">
          <code>{curl}</code>
        </pre>
      </section>

      <p className="text-xs text-fd-muted-foreground">
        For a live end-to-end run, use{" "}
        <a href="/docs/getting-started/quickstart" className="text-fd-primary underline underline-offset-2">
          Quickstart
        </a>{" "}
        or the dashboard demo room.
      </p>
    </div>
  );
}
