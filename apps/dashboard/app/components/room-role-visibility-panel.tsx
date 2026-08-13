"use client";

import { useMemo, useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button, Section } from "./ui";

interface RoomRoleVisibilityPanelProps {
  roomId: string;
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

export function RoomRoleVisibilityPanel({ roomId }: RoomRoleVisibilityPanelProps) {
  const sdkExample = useMemo(
    () =>
      [
        "// Evaluator-only note in the same live room (ReclIA-style)",
        `await client.createMessage("${roomId}",`,
        '  "Used nested loops; ask about optimization.",',
        "  { visibility: \"role:evaluator\" },",
        ");",
      ].join("\n"),
    [roomId],
  );

  return (
    <Section
      title="Role-scoped messages"
      description="Notes for evaluators or teachers without showing them to everyone in the room."
    >
      <p className="text-sm text-muted-foreground">
        Set <code className="text-xs">room_members.role</code> when you add members, then send with{" "}
        <code className="text-xs">visibility: &quot;role:evaluator&quot;</code>. History and WebSocket
        fan-out respect the role. See the docs for whisper vs role scopes.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
        <code>{sdkExample}</code>
      </pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton text={sdkExample} label="Copy SDK snippet" />
      </div>
    </Section>
  );
}
