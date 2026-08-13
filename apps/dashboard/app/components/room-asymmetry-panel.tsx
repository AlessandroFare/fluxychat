"use client";

import { useCallback, useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Button, Section } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";

const INTERVIEW_EVAL_PROFILE = {
  name: "interview_eval",
  roles: {
    evaluator: { privateHints: true, aiNotes: true, panel: "notes" },
    member: { privateHints: false, aiNotes: false, panel: "candidate" },
  },
};

interface RoomAsymmetryPanelProps {
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

export function RoomAsymmetryPanel({ roomId, memberJwt }: RoomAsymmetryPanelProps) {
  const sdkSnippet = [
    `await client.createMessage("${roomId}", "Private evaluator note", {`,
    '  visibility: "role:evaluator",',
    "});",
  ].join("\n");

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function applyInterviewEvalPack() {
    if (!memberJwt.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const base = getPublicWorkerUrl().replace(/\/$/, "");
      await fetchWorkerJson(`${base}/rooms/${encodeURIComponent(roomId)}/session-profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${memberJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile: INTERVIEW_EVAL_PROFILE }),
      });
      setStatus("Interview eval asymmetry profile saved for this room.");
    } catch (err) {
      setStatus(messageFromUnknown(err, "Failed to save profile"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Asymmetric session (PH-113)"
      description="Role packs: evaluators see AI notes, candidates see the public thread only."
    >
      <p className="text-sm text-muted-foreground">
        Pair with <code className="text-xs">role:evaluator</code> messages and member roles on{" "}
        <code className="text-xs">room_members</code>.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">
        <code>{sdkSnippet}</code>
      </pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void applyInterviewEvalPack()}>
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Apply interview-eval pack
        </Button>
        <CopyButton text={sdkSnippet} label="Copy SDK snippet" />
      </div>
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </Section>
  );
}
