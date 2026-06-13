"use client";

import { useParams, useRouter } from "next/navigation";
import { AgentProfileEditor } from "@/app/components/agent-profile-editor";
import { Panel } from "@/app/components/ui";
import { useAgentsConsole } from "../../agents-console-context";

export default function AgentEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const {
    selectedAgent,
    editForm,
    setEditForm,
    llmCatalog,
    updatingAgent,
    saveAgentEdits,
    openLlmKeys,
  } = useAgentsConsole();

  if (!selectedAgent || selectedAgent.id !== agentId) {
    return (
      <Panel className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
        Agent not found or still loading.
      </Panel>
    );
  }

  return (
    <AgentProfileEditor
      title="Edit agent profile"
      description={`Updating ${selectedAgent.name}`}
      values={editForm}
      onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
      llmCatalog={llmCatalog}
      onConfigureKeys={(providerId) =>
        openLlmKeys({ providerId, returnTo: `/agents/${agentId}/edit` })
      }
      primaryLabel="Save changes"
      onPrimary={() => void saveAgentEdits(agentId)}
      primaryDisabled={!editForm.name.trim()}
      primaryLoading={updatingAgent}
      onCancel={() => router.push(`/agents/${agentId}`)}
    />
  );
}
