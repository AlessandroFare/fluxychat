"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  fetchProjectLlmCredentials,
  saveProjectLlmCredential,
  type ProjectLlmCredential,
} from "@/lib/llm-catalog-client";
import { AGENT_PROVIDER_OPTIONS } from "@/lib/agent-catalog";
import { messageFromUnknown } from "@/lib/error-message";
import { Button, Input, Section } from "./ui";

interface LlmProviderCredentialsProps {
  adminJwt: string;
}

export function LlmProviderCredentials({ adminJwt }: LlmProviderCredentialsProps) {
  const [credentials, setCredentials] = useState<ProjectLlmCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProjectLlmCredentials(adminJwt.trim());
      setCredentials(rows);
      const urlMap: Record<string, string> = {};
      for (const row of rows) {
        if (row.baseUrl) urlMap[row.providerId] = row.baseUrl;
      }
      setDraftUrls(urlMap);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load credentials"));
    } finally {
      setLoading(false);
    }
  }, [adminJwt]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(providerId: string) {
    setSaving(providerId);
    setError(null);
    setNotice(null);
    try {
      await saveProjectLlmCredential(adminJwt.trim(), providerId, {
        apiKey: draftKeys[providerId] || undefined,
        baseUrl: draftUrls[providerId] ?? undefined,
      });
      setDraftKeys((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      setNotice(`Saved credentials for ${providerId}.`);
      await load();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setSaving(null);
    }
  }

  const configuredIds = new Set(credentials.filter((c) => c.hasApiKey).map((c) => c.providerId));

  return (
    <Section
      title="Project LLM credentials"
      description="Bring your own LLM keys per project (encrypted in D1 when WEBHOOK_SECRET_ENCRYPTION_KEY is set). Keys override Worker env defaults. The @fluxychat/sdk npm package never includes provider secrets — only your Fluxy JWT/API key for chat."
    >
      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mb-2 text-sm text-green-400">{notice}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <div className="grid gap-3">
        {AGENT_PROVIDER_OPTIONS.filter(
          (p) => p.allowCustomBaseUrl || ["openai", "anthropic", "zencode", "minimax", "openrouter"].includes(p.id),
        ).map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-border/60 bg-background/40 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground">
                {configuredIds.has(p.id) ? "project key set" : "using worker env or unset"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                type="password"
                placeholder="API key (leave empty to keep)"
                value={draftKeys[p.id] ?? ""}
                onChange={(e) =>
                  setDraftKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
              />
              <Input
                placeholder="Base URL override (optional)"
                value={draftUrls[p.id] ?? ""}
                onChange={(e) =>
                  setDraftUrls((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
              />
            </div>
            <Button
              className="mt-2"
              size="sm"
              onClick={() => void handleSave(p.id)}
              disabled={saving === p.id}
            >
              {saving === p.id ? "Saving…" : "Save"}
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}
