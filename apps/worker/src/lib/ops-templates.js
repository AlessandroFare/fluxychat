/**
 * Ready-to-install ops workflows. Installing publishes the definition and
 * patches the policy so provider events actually reach it.
 */

export const OPS_DEFINITION_TEMPLATES = [
  {
    slug: "incident-response",
    title: "Incident response",
    description:
      "An incident webhook reads the tracked incident timeline, gathers evidence from indexed files (with citations), asks an owner to approve, then notifies the room.",
    policyPatch: { incidentWorkflowSlug: "incident-response" },
    definition: {
      slug: "incident-response",
      title: "Incident response",
      trigger: { type: "webhook", source: "incident" },
      inputs: [],
      steps: [
        {
          id: "gather",
          type: "agent_task",
          instruction:
            "Collect evidence for this incident: read the tracked incident and its recent timeline (incidents.read), search indexed runbooks, postmortems and docs, then summarize with citations.",
          tools: ["files.search", "incidents.read"],
          budget: { maxToolCalls: 4, maxTokens: 20000 },
          cite: true,
          timeout: { after: "10m" },
          next: "approve",
        },
        {
          id: "approve",
          type: "approval",
          roles: ["owner"],
          quorum: { default: 1 },
          timeout: { after: "1h" },
          next: "notify",
        },
        {
          id: "notify",
          type: "tool_call",
          tool: "notify.send",
          input: {
            role: "member",
            message: "Incident triage evidence collected and approved.",
          },
          timeout: { after: "1m" },
          next: "end",
        },
        { id: "end", type: "end" },
      ],
    },
  },
];

export function listOpsTemplates() {
  return OPS_DEFINITION_TEMPLATES.map(({ slug, title, description }) => ({ slug, title, description }));
}

export function getOpsTemplate(slug) {
  const wanted = String(slug || "").trim().toLowerCase();
  return OPS_DEFINITION_TEMPLATES.find((template) => template.slug === wanted) || null;
}

export async function installOpsTemplate(store, { projectId, slug, actor }) {
  const template = getOpsTemplate(slug);
  if (!template) return { ok: false, error: "template_not_found", status: 404 };
  const definition = await store.createDefinition({
    projectId,
    slug: template.slug,
    createdBy: actor,
  });
  const version = await store.nextVersionNumber(projectId, definition.id);
  const saved = await store.saveVersion({
    projectId,
    definitionId: definition.id,
    version,
    status: "published",
    definition: template.definition,
    createdBy: actor,
    publishedBy: actor,
  });
  if (template.policyPatch) {
    const { normalizeOpsPolicy } = await import("./ops-policy.js");
    const current = normalizeOpsPolicy(await store.getPolicy(projectId));
    await store.putPolicy(projectId, { ...current, ...template.policyPatch }, actor);
  }
  return {
    ok: true,
    definition: { id: definition.id, slug: definition.slug },
    version: { id: saved.id, version: saved.version, status: saved.status },
  };
}
