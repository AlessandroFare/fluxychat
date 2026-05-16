"use client";

import React, { useMemo } from "react";
import { FormField } from "./form-field";
import { ModelCapabilityBadges } from "./model-capability-badges";
import { Input } from "./ui";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";
import {
  AGENT_PROVIDER_OPTIONS,
  applyModelInput,
  expandModelShortcut,
  formatModelRef,
  modelSuggestionsForProvider,
  parseModelRef,
  providerAllowsCustomBaseUrl,
  providerHint,
} from "@/lib/agent-catalog";

export interface AgentFormValues {
  name: string;
  handle: string;
  provider: string;
  model: string;
  capabilities: string;
  systemPrompt: string;
  contextFetchUrl: string;
  toolExecuteUrl: string;
  llmBaseUrl: string;
}

interface AgentFormFieldsProps {
  values: AgentFormValues;
  onChange: (patch: Partial<AgentFormValues>) => void;
  llmCatalog: LlmCatalogResponse | null;
  idPrefix?: string;
}

export function AgentFormFields({
  values,
  onChange,
  llmCatalog,
  idPrefix = "agent",
}: AgentFormFieldsProps) {
  const { provider, model } = values;

  const resolvedModelRef = useMemo(
    () => parseModelRef(provider, model).modelRef,
    [provider, model],
  );

  const selectedModelCapabilities = useMemo(() => {
    if (!llmCatalog) return null;
    const prov = llmCatalog.providers.find((p) => p.id === provider);
    return prov?.models.find((m) => m.id === model)?.capabilities ?? null;
  }, [llmCatalog, provider, model]);

  const modelDatalistOptions = useMemo(() => {
    const local = modelSuggestionsForProvider(provider);
    if (!llmCatalog) return local;
    const prov = llmCatalog.providers.find((p) => p.id === provider);
    const fromCatalog = (prov?.models ?? []).map((m) => m.id);
    const live =
      provider === "openrouter" && llmCatalog.liveModels
        ? llmCatalog.liveModels.models.slice(0, 40).map((m) => m.id)
        : [];
    return [...new Set([...local, ...fromCatalog, ...live])];
  }, [llmCatalog, provider]);

  const datalistId = `${idPrefix}-models`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Display name" hint="Shown in the console and agent list.">
        <Input
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Support bot"
        />
      </FormField>
      <FormField label="Handle" hint="Optional @mention (e.g. support → @support).">
        <Input
          value={values.handle}
          onChange={(e) => onChange({ handle: e.target.value })}
          placeholder="support"
        />
      </FormField>
      <FormField
        label="Provider"
        hint={providerHint(provider) || "Worker or project credentials supply API keys."}
      >
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={provider}
          onChange={(e) => {
            const next = e.target.value;
            const suggestions = modelSuggestionsForProvider(next);
            onChange({
              provider: next,
              model: suggestions.length ? suggestions[0] : values.model,
            });
          }}
        >
          {AGENT_PROVIDER_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </FormField>
      {providerAllowsCustomBaseUrl(provider) ? (
        <FormField
          label="API base URL"
          hint="OpenAI-compatible /v1 — ZenCode, proxies, Ollama."
          className="sm:col-span-2"
        >
          <Input
            value={values.llmBaseUrl}
            onChange={(e) => onChange({ llmBaseUrl: e.target.value })}
            placeholder="https://your-gateway.example/v1"
          />
        </FormField>
      ) : null}
      <FormField
        label="Model"
        hint="Model id, provider/model, or shortcut (minimax-free, claude-sonnet)."
        className={providerAllowsCustomBaseUrl(provider) ? "" : "sm:col-span-2"}
      >
        <Input
          value={model}
          onChange={(e) => {
            const raw = e.target.value;
            const expanded = expandModelShortcut(raw);
            if (raw.includes("/") || expanded !== raw.trim()) {
              const applied = applyModelInput(provider, raw);
              onChange({ provider: applied.provider, model: applied.model });
            } else {
              onChange({ model: raw });
            }
          }}
          placeholder="zencode/minimax-m2.5-free"
          list={datalistId}
        />
        <datalist id={datalistId}>
          {modelDatalistOptions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-muted-foreground">
          Resolved: <code>{resolvedModelRef}</code>
          {selectedModelCapabilities ? (
            <span className="ml-2">
              <ModelCapabilityBadges capabilities={selectedModelCapabilities} />
            </span>
          ) : null}
        </p>
      </FormField>
      <FormField label="Capabilities" hint="Comma-separated (usually chat)." className="sm:col-span-2">
        <Input
          value={values.capabilities}
          onChange={(e) => onChange({ capabilities: e.target.value })}
          placeholder="chat"
        />
      </FormField>
      <FormField label="System prompt" className="sm:col-span-2">
        <Input
          value={values.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant…"
        />
      </FormField>
      <FormField label="Context fetch URL" hint="Optional pre-LLM context hook.">
        <Input
          value={values.contextFetchUrl}
          onChange={(e) => onChange({ contextFetchUrl: e.target.value })}
          placeholder="https://…"
        />
      </FormField>
      <FormField label="Tool execute URL" hint="Optional function-calling endpoint.">
        <Input
          value={values.toolExecuteUrl}
          onChange={(e) => onChange({ toolExecuteUrl: e.target.value })}
          placeholder="https://…"
        />
      </FormField>
    </div>
  );
}
