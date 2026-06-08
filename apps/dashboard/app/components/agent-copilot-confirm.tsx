"use client";

import React from "react";
import { Button } from "./ui";

export interface AgentCopilotConfirmProps {
  previewText: string;
  modeLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function AgentCopilotConfirm({
  previewText,
  modeLabel,
  busy = false,
  onConfirm,
  onEdit,
}: AgentCopilotConfirmProps) {
  return (
    <div
      className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm"
      role="dialog"
      aria-label="Confirm before send"
      data-testid="agent-copilot-confirm"
    >
      <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
        Review before sending ({modeLabel})
      </p>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background/80 p-2 text-xs text-foreground">
        {previewText}
      </pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          className="h-8 px-3 text-xs"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Sending…" : "Confirm send"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          disabled={busy}
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}
