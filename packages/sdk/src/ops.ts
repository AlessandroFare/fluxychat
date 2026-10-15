/**
 * FluxyOps client surface. Processes are data: the Builder drafts a definition,
 * humans publish, a generic engine runs it in a room.
 */

export type OpsStepType =
  | "human_task"
  | "agent_task"
  | "approval"
  | "wait_for_guest"
  | "tool_call"
  | "branch"
  | "notify"
  | "end";

export interface OpsClient {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export function opsPaths() {
  return {
    builderSessions: "/ops/builder/sessions",
    validate: "/ops/builder/validate",
    simulate: "/ops/builder/simulate",
    publishRequest: "/ops/builder/publish-request",
    runs: "/ops/runs",
    inbox: "/ops/inbox",
  } as const;
}

export async function startBuilderSession(client: OpsClient, text: string) {
  const res = await client.fetch(opsPaths().builderSessions, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function fetchOpsInbox(client: OpsClient) {
  const res = await client.fetch(opsPaths().inbox);
  return res.json();
}

export async function fetchOpsRun(client: OpsClient, runId: string) {
  const res = await client.fetch(`${opsPaths().runs}/${runId}`);
  return res.json();
}
