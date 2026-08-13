"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button, Section } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

interface RoomMcpConnectPanelProps {
  roomId: string;
  memberJwt: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void copy()}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function RoomMcpConnectPanel({ roomId, memberJwt }: RoomMcpConnectPanelProps) {
  const workerUrl = getPublicWorkerUrl().replace(/\/$/, "");
  const mcpUrl = `${workerUrl}/mcp/rooms/${encodeURIComponent(roomId)}`;

  const curlExample = useMemo(
    () =>
      [
        `curl -sS -X POST "${mcpUrl}" \\`,
        `  -H "Authorization: Bearer ${memberJwt || "<member-jwt>"}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"send_message","arguments":{"content":"Hello from an external agent"}},"id":1}'`,
      ].join("\n"),
    [mcpUrl, memberJwt],
  );

  const claudeDesktopConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            [`fluxychat-${roomId}`]: {
              url: mcpUrl,
              headers: {
                Authorization: `Bearer ${memberJwt || "<member-jwt>"}`,
              },
            },
          },
        },
        null,
        2,
      ),
    [mcpUrl, memberJwt, roomId],
  );

  return (
    <Section title="Connect external agent (MCP)" className="mt-6">
      <p className="mb-3 text-sm text-muted-foreground">
        Point Claude Desktop, Gemini, or any MCP client at this room. The agent uses your member JWT and
        posts to the same timeline as humans in the chat below.
      </p>

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Room MCP endpoint</p>
          <code className="block break-all rounded bg-muted px-2 py-1.5 text-xs">{mcpUrl}</code>
        </div>

        <div className="flex flex-wrap gap-2">
          <CopyButton text={mcpUrl} label="Copy URL" />
          <CopyButton text={curlExample} label="Copy curl" />
          <CopyButton text={claudeDesktopConfig} label="Copy Claude config" />
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Tools on this endpoint</summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>send_message: post to this room</li>
            <li>read_timeline: recent messages (respects whisper rules)</li>
            <li>list_participants: members and who is online</li>
            <li>subscribe_events: SSE / WebSocket URLs for live events</li>
          </ul>
        </details>
      </div>

      {!memberJwt ? (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Add a member JWT in Quickstart to generate working curl and Claude Desktop snippets.
        </p>
      ) : null}
    </Section>
  );
}
