"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Banner, Button, EmptyState, Input, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import { opsAnswerRunInput, opsInputRequests, type OpsInputRequest } from "@/lib/ops-client";

/**
 * MRTR: an upstream MCP tool asked a question mid-call. The run waits here
 * until someone answers; the same request is a card in the run room.
 */
export function OpsInputsSection({ token }: { token: string }) {
  const [items, setItems] = useState<OpsInputRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const auth = token.trim();
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await opsInputRequests(auth);
        if (cancelled) return;
        setItems(data.items || []);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(messageFromUnknown(err, "Could not load open questions"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadKey]);

  async function answer(item: OpsInputRequest) {
    // The server's requestedSchema names the fields it wants; without one the
    // only safe guess is a single free-form value. Required keys must be
    // filled; optional ones are sent only when the user filled them.
    const properties = item.requestedSchema?.properties || {};
    const keys = Object.keys(properties).length ? Object.keys(properties) : ["answer"];
    const required = item.requestedSchema?.required?.length ? new Set(item.requestedSchema.required) : null;
    const content: Record<string, string> = {};
    for (const key of keys) {
      const value = (values[`${item.runId}:${key}`] || "").trim();
      if (!value) {
        if (!required || required.has(key)) {
          setActionError(`Fill in "${properties[key]?.title || key}" before answering.`);
          return;
        }
        continue;
      }
      content[key] = value;
    }
    if (!Object.keys(content).length) {
      setActionError("Fill in at least one field before answering.");
      return;
    }
    setBusy(item.runId);
    setActionError(null);
    setNotice(null);
    try {
      await opsAnswerRunInput(token.trim(), item.runId, [{ id: item.requestId || "input", content }]);
      setNotice("Answered. The run resumes the same call.");
    } catch (err) {
      setActionError(messageFromUnknown(err, "Answer failed"));
    } finally {
      // Reload on failure too: the run may have moved on, so the row is stale.
      setLoadKey((key) => key + 1);
      setBusy(null);
    }
  }

  const error = actionError || loadError;

  return (
    <Section
      title="Questions waiting"
      description="An external tool stopped mid-call to ask for input. The answer resumes that same call; the question also appears in the run room."
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}
      {!token.trim() ? (
        <p className="text-sm text-muted-foreground">Sign in with a project token to see open questions.</p>
      ) : items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No open questions"
          description="Questions appear here when a tool call needs a human answer."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const properties = item.requestedSchema?.properties || {};
            const keys = Object.keys(properties).length ? Object.keys(properties) : ["answer"];
            return (
              <li key={`${item.runId}:${item.stepId}`} className="space-y-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{item.message}</p>
                  <p className="text-muted-foreground">
                    {item.tool}
                    {item.server ? ` on ${item.server}` : ""} · run {item.runId.slice(0, 8)}
                  </p>
                </div>
                {keys.map((key) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-xs font-medium">{properties[key]?.title || key}</span>
                    <Input
                      value={values[`${item.runId}:${key}`] || ""}
                      placeholder={properties[key]?.description || ""}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [`${item.runId}:${key}`]: event.target.value }))
                      }
                    />
                  </label>
                ))}
                <Button type="button" size="sm" disabled={busy !== null} onClick={() => void answer(item)}>
                  {busy === item.runId ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  Answer
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
