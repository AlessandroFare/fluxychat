"use client";

import React, { useState } from "react";
import { FormField } from "./form-field";
import { LlmProviderModelPicker } from "./llm-provider-model-picker";
import { ModelParamsPanel } from "./model-params-panel";
import { Input, Textarea } from "./ui";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";
import type { AgentFormValues } from "@/lib/agent-form";

export type { AgentFormValues };

interface AgentFormFieldsProps {
  values: AgentFormValues;
  onChange: (patch: Partial<AgentFormValues>) => void;
  llmCatalog: LlmCatalogResponse | null;
  idPrefix?: string;
  onConfigureKeys?: (providerId: string) => void;
}

/** Compact agent form (e.g. onboarding). Prefer AgentProfileForm on the Agents page. */
export function AgentFormFields({
  values,
  onChange,
  llmCatalog,
  idPrefix = "agent",
  onConfigureKeys,
}: AgentFormFieldsProps) {
  const [showParams, setShowParams] = useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-4">
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
        </div>
        <div className="shrink-0 pt-1">
          <ModelParamsPanel
            open={showParams}
            onOpenChange={setShowParams}
            params={{
              temperature: values.temperature,
              maxTokens: values.maxTokens,
              topP: values.topP,
              frequencyPenalty: values.frequencyPenalty,
              presencePenalty: values.presencePenalty,
              stopSequences: values.stopSequences,
              reasoningEffort: values.reasoningEffort,
              reasoningSummary: values.reasoningSummary,
            }}
            onChange={(patch) => onChange(patch)}
          />
        </div>
      </div>

      <div className="sm:col-span-2">
        <LlmProviderModelPicker
          values={{
            provider: values.provider,
            model: values.model,
            llmBaseUrl: values.llmBaseUrl,
          }}
          onChange={(patch) => onChange(patch)}
          llmCatalog={llmCatalog}
          idPrefix={idPrefix}
          onConfigureKeys={onConfigureKeys}
        />
      </div>

      <FormField label="Capabilities" hint="Comma-separated (usually chat)." className="sm:col-span-2">
        <Input
          value={values.capabilities}
          onChange={(e) => onChange({ capabilities: e.target.value })}
          placeholder="chat"
        />
      </FormField>
      <FormField
        label="System prompt (agent instructions)"
        hint="What the agent is told about itself and its job. Sent on every invoke."
        className="sm:col-span-2"
      >
        <Textarea
          value={values.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant…"
          rows={3}
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
