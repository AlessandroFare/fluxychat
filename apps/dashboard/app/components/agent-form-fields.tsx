"use client";

import React from "react";
import { FormField } from "./form-field";
import { LlmProviderModelPicker } from "./llm-provider-model-picker";
import { Input, Textarea } from "./ui";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";

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
  /** Optional second provider when primary fails (stored in config.llm). */
  fallbackProvider: string;
  fallbackModel: string;
}

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
      <FormField label="System prompt" className="sm:col-span-2">
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
