"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentProfileEditor } from "@/app/components/agent-profile-editor";
import { useAgentsConsole } from "../agents-console-context";

export default function NewAgentPage() {
  const router = useRouter();
  const { createForm, setCreateForm, llmCatalog, creating, createAgent, openLlmKeys } =
    useAgentsConsole();

  return (
    <AgentProfileEditor
      title="New agent profile"
      description="Adds a bot to this project. Use @handle in chat for streaming invoke."
      values={createForm}
      onChange={(patch) => setCreateForm((f) => ({ ...f, ...patch }))}
      llmCatalog={llmCatalog}
      onConfigureKeys={(providerId) =>
        openLlmKeys({ providerId, returnTo: "/agents/new" })
      }
      primaryLabel="Create agent"
      onPrimary={() => void createAgent()}
      primaryDisabled={!createForm.name.trim()}
      primaryLoading={creating}
      onCancel={() => router.push("/agents")}
    />
  );
}
