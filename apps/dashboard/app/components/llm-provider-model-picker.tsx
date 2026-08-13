"use client";

import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, Wrench, Zap } from "lucide-react";
import { FormField } from "./form-field";
import { ModelCapabilityBadges } from "./model-capability-badges";
import { LlmCredentialStatus } from "./llm-credential-status";
import { SearchableSelect } from "./searchable-select";
import { Button, Input } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";
import {
  applyModelInput,
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
  const [catalogModels, setCatalogModels] = useState<Array<{ id: string; providerId: string; displayName?: string }>>([]);
  const [catalogProviders, setCatalogProviders] = useState<Array<{ id: string; name: string; logoUrl?: string }>>([]);
  const [customModel, setCustomModel] = useState(false);

  // Fetch models for the current provider whenever it changes.
  useEffect(() => {
    let cancelled = false;
    const base = getPublicWorkerUrl();
    const params = new URLSearchParams();
    if (provider) params.set("provider", provider);
    params.set("limit", "200");
    fetch(`${base}/llm-models?${params}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setCatalogModels(data.models || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [provider]);

  // Fetch provider list once on mount.
  useEffect(() => {
    fetch(`${getPublicWorkerUrl()}/llm-models/providers`)
      .then((r) => r.json())
      .then((data) => { if (data?.providers) setCatalogProviders(data.providers); })
      .catch(() => {});
  }, []);

  const providerOptions = useMemo(() => {
    const fromCatalog = listProviderOptions(llmCatalog);
    const catalogMap = new Map(fromCatalog.map((p) => [p.id, p]));
    // Merge models.dev providers on top — they are the authoritative full list.
    const merged = catalogProviders.map((md) => {
      const existing = catalogMap.get(md.id);
      return existing
        ? { ...existing, logoUrl: md.logoUrl }
        : { id: md.id, label: md.name, logoUrl: md.logoUrl };
    });
    // Add any catalog-only providers not in models.dev.
    const mdIds = new Set(catalogProviders.map((p) => p.id));
    for (const cp of fromCatalog) {
      if (!mdIds.has(cp.id)) merged.push({ ...cp, logoUrl: undefined });
    }
    return merged;
  }, [llmCatalog, catalogProviders]);
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
    const fromCatalog = (catalogProvider?.models ?? []).map((m) => m.id);
    const fromModelsDev = catalogModels
      .filter((m) => m.providerId === provider)
      .map((m) => m.id);
    return [...new Set([...fromCatalog, ...fromModelsDev])];
  }, [catalogProvider, provider, catalogModels]);

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
        <SearchableSelect
          value={provider}
          options={providerOptions}
          onChange={(next) => {
            const prov = findCatalogProvider(llmCatalog, next);
            const fromModelsDev = catalogModels
              .filter((m) => m.providerId === next)
              .map((m) => m.id);
            const firstModel =
              prov?.models[0]?.id ??
              fromModelsDev[0] ??
              "";
            onChange({ provider: next, model: firstModel });
            setCustomModel(false);
          }}
          placeholder="Select a provider"
        />
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
            No API key for this provider yet. Configure project or Worker env keys.
          </p>
        ) : null}
      </FormField>

      {allowBaseUrl ? (
        <FormField
          label="API base URL"
          hint="OpenAI-compatible /v1: gateways, Ollama, proxies."
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
        hint="Select a model for the chosen provider."
        className={allowBaseUrl ? "sm:col-span-2" : "sm:col-span-2"}
      >
        <SearchableSelect
          value={modelDatalistOptions.includes(model) ? model : "__custom__"}
          options={[
            ...modelDatalistOptions.slice(0, 60).map((m) => ({ id: m, label: m })),
            ...(modelDatalistOptions.length > 60
              ? [{ id: "__more__", label: `── ${modelDatalistOptions.length - 60} more models ──` }]
              : []),
            { id: "__custom__", label: model && !modelDatalistOptions.includes(model) ? `Custom: ${model}` : "Type custom model ID…" },
          ]}
          onChange={(val) => {
            if (val === "__custom__" || val === "__more__") {
              setCustomModel(true);
            } else {
              setCustomModel(false);
              onChange({ model: val });
            }
          }}
          placeholder="Select a model"
        />
        {customModel || (model && !modelDatalistOptions.includes(model)) ? (
          <Input
            value={model}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw.includes("/")) {
                const applied = applyModelInput(provider, raw);
                onChange({ provider: applied.provider, model: applied.model });
              } else {
                onChange({ model: raw });
              }
            }}
            placeholder="zencode/minimax-m2.5-free"
            list={datalistId}
            className="mt-2"
          />
        ) : null}
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

