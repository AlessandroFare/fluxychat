"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface ScheduleSendProps {
  initialContent?: string;
  onSchedule: (content: string, sendAt: string) => Promise<void>;
  onCancel?: () => void;
}

function defaultSendAtLocal(): string {
  const d = new Date(Date.now() + 3600000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleSend({ initialContent = "", onSchedule, onCancel }: ScheduleSendProps) {
  const [content, setContent] = useState(initialContent);
  const [sendAtLocal, setSendAtLocal] = useState(defaultSendAtLocal);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSchedule() {
    const trimmed = content.trim();
    if (!trimmed) return;
    const sendAt = new Date(sendAtLocal);
    if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      setError("Pick a future date and time.");
      return;
    }
    setError(null);
    setScheduling(true);
    try {
      await onSchedule(trimmed, sendAt.toISOString());
      setContent("");
      setSendAtLocal(defaultSendAtLocal());
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Schedule message
      </h4>
      <textarea
        className="mt-2 min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Message to send later…"
      />
      <label className="mt-2 block text-xs">
        <span className="mb-1 block text-muted-foreground">Send at (local time)</span>
        <Input
          type="datetime-local"
          value={sendAtLocal}
          onChange={(e) => setSendAtLocal(e.target.value)}
          className="text-xs"
        />
      </label>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel ? (
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          className="h-6 text-xs"
          onClick={() => void handleSchedule()}
          disabled={scheduling || !content.trim()}
        >
          {scheduling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Schedule
        </Button>
      </div>
    </div>
  );
}
