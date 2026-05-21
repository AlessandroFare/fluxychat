"use client";

import React, { useMemo } from "react";
import { KeyRound, Wrench, Zap } from "lucide-react";
import { FormField } from "./form-field";
import { ModelCapabilityBadges } from "./model-capability-badges";
import { LlmCredentialStatus } from "./llm-credential-status";
import { Button, Input } from "./ui";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";
import {
  applyModelInput,
  expandModelShortcut,
  modelSuggestionsForProvider,
  parseModelRef,
  providerAllowsCustomBaseUrl,
  providerHint,
} from "@/lib/agent-catalog";
import {
  credentialStatusSummary,
  findCatalogProvider,
  listProviderOptions,
  resolveModelCapabilities,
} from "@/lib/llm-registry-ui";

export interface LlmProviderModelPickerValues {
  provider: string;
  model: string;
  llmBaseUrl: string;
}

interface LlmProviderModelPickerProps {
  values: LlmProviderModelPickerValues;
  onChange: (patch: Partial<LlmProviderModelPickerValues>) => void;
  llmCatalog: LlmCatalogResponse | null;
  idPrefix?: string;
  /** Opens LLM keys UI scoped to the current provider. */
  onConfigureKeys?: (providerId: string) => void;
}

export function LlmProviderModelPicker({
  values,
  onChange,
  llmCatalog,
  idPrefix = "llm",
  onConfigureKeys,
}: LlmProviderModelPickerProps) {
  const { provider, model } = values;
  const providerOptions = useMemo(
    () => listProviderOptions(llmCatalog),
    [llmCatalog],
  );
  const catalogProvider = findCatalogProvider(llmCatalog, provider);
  const resolvedModelRef = useMemo(
    () => parseModelRef(provider, model).modelRef,
    [provider, model],
  );
  const selectedModelCapabilities = useMemo(
    () => resolveModelCapabilities(llmCatalog, provider, model),
    [llmCatalog, provider, model],
  );

  const modelDatalistOptions = useMemo(() => {
    const local = modelSuggestionsForProvider(provider);
    const fromCatalog = (catalogProvider?.models ?? []).map((m) => m.id);
    const live =
      provider === "openrouter" && llmCatalog?.liveModels
        ? llmCatalog.liveModels.models.slice(0, 40).map((m) => m.id)
        : [];
    return [...new Set([...local, ...fromCatalog, ...live])];
  }, [catalogProvider, llmCatalog, provider]);

  const allowBaseUrl =
    catalogProvider?.allowCustomBaseUrl ?? providerAllowsCustomBaseUrl(provider);
  const datalistId = `${idPrefix}-models`;
  const { ready: keysReady } = credentialStatusSummary(catalogProvider?.credentialStatus);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label="Provider"
        hint={
          providerHint(provider) ||
          catalogProvider?.apiStyle ||
          "Worker or project credentials supply API keys."
        }
        className="sm:col-span-2"
      >
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={provider}
          onChange={(e) => {
            const next = e.target.value;
            const prov = findCatalogProvider(llmCatalog, next);
            const firstModel =
              prov?.models[0]?.id ?? modelSuggestionsForProvider(next)[0] ?? "";
            onChange({ provider: next, model: firstModel });
          }}
        >
          {providerOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {catalogProvider ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LlmCredentialStatus status={catalogProvider.credentialStatus} />
            {catalogProvider.supportsStreaming ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Zap className="h-3 w-3" aria-hidden />
                streaming
              </span>
            ) : null}
            {catalogProvider.supportsTools ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Wrench className="h-3 w-3" aria-hidden />
                tools
              </span>
            ) : null}
            <span className="text-[10px] text-muted-foreground">
              {catalogProvider.apiStyle}
            </span>
            {onConfigureKeys ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onConfigureKeys(provider)}
              >
                <KeyRound className="mr-1 h-3 w-3" aria-hidden />
                Configure keys
              </Button>
            ) : null}
          </div>
        ) : onConfigureKeys ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => onConfigureKeys(provider)}
          >
            <KeyRound className="mr-1 h-3 w-3" aria-hidden />
            Configure keys
          </Button>
        ) : null}
        {!keysReady && onConfigureKeys ? (
          <p className="mt-1 text-xs text-amber-800">
            No API key for this provider yet — configure project or Worker env keys.
          </p>
        ) : null}
      </FormField>

      {allowBaseUrl ? (
        <FormField
          label="API base URL"
          hint="OpenAI-compatible /v1 — gateways, Ollama, proxies."
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
        className={allowBaseUrl ? "sm:col-span-2" : "sm:col-span-2"}
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
    </div>
  );
}
