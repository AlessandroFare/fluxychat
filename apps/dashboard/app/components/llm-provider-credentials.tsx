"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  fetchProjectLlmCredentials,
  saveProjectLlmCredential,
  type ProjectLlmCredential,
} from "@/lib/llm-catalog-client";
import { AGENT_PROVIDER_OPTIONS, type AgentProviderOption } from "@/lib/agent-catalog";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { Button, Input, Section } from "./ui";
import { cn } from "@/lib/utils";

function providersForCredentialForm(
  focusProviderId: string | null | undefined,
  search: string,
  modelsDevProviders: Array<{ id: string; name: string; logoUrl?: string }>,
): AgentProviderOption[] {
  // Start with known providers that have credential support.
  const knownIds = new Set(AGENT_PROVIDER_OPTIONS.map((p) => p.id));
  // Add all models.dev providers as OpenAI-compatible (they need baseUrl + apiKey).
  const fromModelsDev = modelsDevProviders
    .filter((p) => !knownIds.has(p.id))
    .map((p) => ({
      id: p.id,
      label: p.name,
      models: [],
      allowCustomBaseUrl: true,
      hint: "OpenAI-compatible",
    }));
  const all = [...AGENT_PROVIDER_OPTIONS, ...fromModelsDev];

  if (search) {
    const q = search.toLowerCase();
    return all.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q),
    );
  }

  const base = all;
  if (!focusProviderId || base.some((p) => p.id === focusProviderId)) {
    return base;
  }
  const extra = all.find((p) => p.id === focusProviderId);
  return extra ? [...base, extra] : base;
}

interface LlmProviderCredentialsProps {
  adminJwt: string;
  /** Scroll to and highlight this provider's credential card. */
  focusProviderId?: string | null;
  onSaved?: () => void;
}

export function LlmProviderCredentials({
  adminJwt,
  focusProviderId,
  onSaved,
}: LlmProviderCredentialsProps) {
  const [credentials, setCredentials] = useState<ProjectLlmCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [modelsDevProviders, setModelsDevProviders] = useState<Array<{ id: string; name: string; logoUrl?: string }>>([]);
  const focusCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${getPublicWorkerUrl()}/llm-models/providers`)
      .then((r) => r.json())
      .then((data) => { if (data?.providers) setModelsDevProviders(data.providers); })
      .catch(() => {});
  }, []);

  const providerRows = useMemo(
    () => providersForCredentialForm(focusProviderId, providerSearch, modelsDevProviders),
    [focusProviderId, providerSearch, modelsDevProviders],
  );

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

  useEffect(() => {
    if (!focusProviderId || loading) return;
    const el = focusCardRef.current;
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusProviderId, loading, providerRows.length]);

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
      onSaved?.();
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
      description="Bring your own LLM keys per project (encrypted in D1 when WEBHOOK_SECRET_ENCRYPTION_KEY is set). Keys override Worker env defaults. The @fluxy-chat/sdk npm package never includes provider secrets — only your Fluxy JWT/API key for chat."
    >
      {focusProviderId ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Configuring <code className="font-mono text-xs">{focusProviderId}</code> — paste the
          project API key below, then Save.
        </p>
      ) : null}
      {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="mb-2 text-sm text-green-400">{notice}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={providerSearch}
          onChange={(e) => setProviderSearch(e.target.value)}
          placeholder="Search providers (openai, anthropic, custom…)"
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-8 text-sm"
        />
        {providerSearch ? (
          <button
            type="button"
            onClick={() => setProviderSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>
      <div className="grid gap-3">
        {providerRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers match your search.</p>
        ) : null}
        {providerRows.map((p) => {
          const isFocused = focusProviderId === p.id;
          return (
            <div
              key={p.id}
              id={`llm-credential-${p.id}`}
              ref={isFocused ? focusCardRef : undefined}
              className={cn(
                "rounded-lg border bg-background/40 p-3 transition-shadow",
                isFocused
                  ? "border-brand/50 ring-2 ring-brand/25"
                  : "border-border/60",
              )}
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
                  autoFocus={isFocused}
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
          );
        })}
      </div>
    </Section>
  );
}

