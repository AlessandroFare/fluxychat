"use client";

import React from "react";
import { Bot, Cpu, Link2, MessageSquareText } from "lucide-react";
import { FormField } from "./form-field";
import { AgentPromptTemplatePicker } from "./agent-prompt-template-picker";
import { LlmProviderModelPicker } from "./llm-provider-model-picker";
import type { AgentFormValues } from "./agent-form-fields";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";
import { Input, Textarea } from "./ui";
import { cn } from "@/lib/utils";

interface AgentProfileSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function AgentProfileSection({
  title,
  description,
  icon,
  children,
}: AgentProfileSectionProps) {
  return (
    <section className="rounded-xl border border-border/60 bg-muted/10 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          {icon}
        </div>
        <div>
          <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export interface AgentProfileFormProps {
  values: AgentFormValues;
  onChange: (patch: Partial<AgentFormValues>) => void;
  llmCatalog: LlmCatalogResponse | null;
  onConfigureKeys?: (providerId: string) => void;
  className?: string;
}

/** Unified agent profile: identity, model registry, instructions, integrations. */
export function AgentProfileForm({
  values,
  onChange,
  llmCatalog,
  onConfigureKeys,
  className,
}: AgentProfileFormProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <AgentProfileSection
        title="Identity"
        description="Display name and @mention handle for room invoke."
        icon={<Bot className="h-4 w-4" aria-hidden />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Display name" hint="Shown in the console and agent list.">
            <Input
              value={values.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Support bot"
            />
          </FormField>
          <FormField label="Handle" hint="Mention in chat: @handle triggers this agent (streaming).">
            <Input
              value={values.handle}
              onChange={(e) => onChange({ handle: e.target.value })}
              placeholder="assistant"
            />
          </FormField>
        </div>
      </AgentProfileSection>

      <AgentProfileSection
        title="Model & provider"
        description="Pulled from the Worker LLM registry. Set API keys in LLM keys."
        icon={<Cpu className="h-4 w-4" aria-hidden />}
      >
        <LlmProviderModelPicker
          values={{
            provider: values.provider,
            model: values.model,
            llmBaseUrl: values.llmBaseUrl,
          }}
          onChange={(patch) => onChange(patch)}
          llmCatalog={llmCatalog}
          idPrefix="profile"
          onConfigureKeys={onConfigureKeys}
        />
        <div className="mt-4 rounded-lg border border-dashed border-border/80 bg-background/50 p-3">
          <p className="mb-3 text-xs font-medium text-foreground">Fallback model (optional)</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Used when the primary provider errors on the first attempt (quota, rate limit, outage).
            Requires API keys for both providers in LLM keys.
          </p>
          <LlmProviderModelPicker
            values={{
              provider: values.fallbackProvider,
              model: values.fallbackModel,
              llmBaseUrl: "",
            }}
            onChange={(patch) =>
              onChange({
                fallbackProvider: patch.provider ?? values.fallbackProvider,
                fallbackModel: patch.model ?? values.fallbackModel,
              })
            }
            llmCatalog={llmCatalog}
            idPrefix="profile-fallback"
            onConfigureKeys={onConfigureKeys}
          />
        </div>
        <FormField
          label="Capabilities"
          hint="Comma-separated (chat, summarize, moderate…)."
          className="mt-4"
        >
          <Input
            value={values.capabilities}
            onChange={(e) => onChange({ capabilities: e.target.value })}
            placeholder="chat"
          />
        </FormField>
      </AgentProfileSection>

      <AgentProfileSection
        title="Instructions"
        description="System prompt sent on every invoke."
        icon={<MessageSquareText className="h-4 w-4" aria-hidden />}
      >
        <AgentPromptTemplatePicker
          className="mb-4"
          onApply={(patch) => onChange(patch)}
        />
        <FormField label="System prompt">
          <Textarea
            value={values.systemPrompt}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
            placeholder="You are a helpful assistant for this product…"
            rows={5}
            className="min-h-[120px] font-mono text-xs"
          />
        </FormField>
      </AgentProfileSection>

      <AgentProfileSection
        title="Integrations"
        description="Optional HTTP hooks for context and tool execution."
        icon={<Link2 className="h-4 w-4" aria-hidden />}
      >
        <div className="grid gap-4 sm:grid-cols-1">
          <FormField label="Context fetch URL" hint="Called before the LLM run for extra context.">
            <Input
              value={values.contextFetchUrl}
              onChange={(e) => onChange({ contextFetchUrl: e.target.value })}
              placeholder="https://your-app.example/api/agent-context"
            />
          </FormField>
          <FormField label="Tool execute URL" hint="Function-calling callback endpoint.">
            <Input
              value={values.toolExecuteUrl}
              onChange={(e) => onChange({ toolExecuteUrl: e.target.value })}
              placeholder="https://your-app.example/api/agent-tools"
            />
          </FormField>
        </div>
      </AgentProfileSection>
    </div>
  );
}
