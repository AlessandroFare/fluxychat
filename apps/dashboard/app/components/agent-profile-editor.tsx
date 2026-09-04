"use client";

import { AgentProfileForm } from "./agent-profile-form";
import { ConsoleFormActions } from "./console-form-actions";
import { ConsolePanelHeader } from "./console-panel-header";
import { Panel } from "./ui";
import type { AgentFormValues } from "@/lib/agent-form";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";

interface AgentProfileEditorProps {
  title: string;
  description?: string;
  values: AgentFormValues;
  onChange: (patch: Partial<AgentFormValues>) => void;
  llmCatalog: LlmCatalogResponse | null;
  onConfigureKeys?: (providerId: string) => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onCancel?: () => void;
}

export function AgentProfileEditor({
  title,
  description,
  values,
  onChange,
  llmCatalog,
  onConfigureKeys,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  onCancel,
}: AgentProfileEditorProps) {
  return (
    <Panel className="rounded-2xl p-6">
      <ConsolePanelHeader title={title} description={description} onClose={onCancel} />
      <AgentProfileForm
        values={values}
        onChange={onChange}
        llmCatalog={llmCatalog}
        onConfigureKeys={onConfigureKeys}
      />
      <ConsoleFormActions
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        primaryDisabled={primaryDisabled}
        primaryLoading={primaryLoading}
        onCancel={onCancel}
      />
    </Panel>
  );
}
