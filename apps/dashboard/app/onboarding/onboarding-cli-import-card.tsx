"use client";

import { useEffect, useState } from "react";
import { Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { Button, Textarea } from "../components/ui";
import { parseCliEnvContent, validateCliEnvImport } from "@/lib/parse-cli-env";
import { cn } from "@/lib/utils";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface OnboardingCliImportCardProps {
  wizard: OnboardingWizard;
  defaultOpen?: boolean;
}

export function OnboardingCliImportCard({ wizard: w, defaultOpen = false }: OnboardingCliImportCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [paste, setPaste] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  function handleImport() {
    setLocalError(null);
    const parsed = parseCliEnvContent(paste);
    const err = validateCliEnvImport(parsed);
    if (err) {
      setLocalError(err);
      return;
    }
    const ok = w.importCliEnv(parsed);
    if (!ok) return;
    setPaste("");
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Terminal className="h-4 w-4 text-primary" aria-hidden />
          Import from create-fluxy-chat
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Ran{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              npx create-fluxy-chat my-app --full -y
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">pnpm setup</code>? Paste
            your generated <code className="font-mono text-[10px]">.env</code> here to jump to First Chat.
          </p>
          <Textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={`VITE_FLUXYCHAT_WORKER_URL=...\nVITE_FLUXYCHAT_MEMBER_JWT=eyJ...\nVITE_FLUXYCHAT_ROOM_ID=...`}
            rows={5}
            className="font-mono text-xs"
          />
          {(localError || w.error) && (
            <p className={cn("text-xs", localError || w.error ? "text-red-500" : "")}>
              {localError ?? w.error}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={handleImport} disabled={!paste.trim()}>
            Import &amp; open First Chat
          </Button>
        </div>
      ) : null}
    </div>
  );
}
