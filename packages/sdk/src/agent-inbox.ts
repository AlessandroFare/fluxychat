/**
 * Agent Inbox: pending HITL / askHuman rows. Accept and ignore map to HITL decide.
 */

export interface AgentInboxItem {
  id: string;
  roomId: string;
  kind: string;
  status: string;
  priority?: number;
  summary?: string;
  dueAt?: string | null;
  snoozed?: boolean;
  interrupt?: { prompt?: string; runId?: string | null };
}

export async function fetchAgentInbox(opts: {
  workerUrl: string;
  token: string;
}): Promise<{ items: AgentInboxItem[]; count: number }> {
  const res = await fetch(`${opts.workerUrl.replace(/\/$/, "")}/inbox/agent`, {
    headers: { Authorization: `Bearer ${opts.token}` },
  });
  if (!res.ok) throw new Error(`agent_inbox_${res.status}`);
  return (await res.json()) as { items: AgentInboxItem[]; count: number };
}

export async function postAgentInboxAction(opts: {
  workerUrl: string;
  token: string;
  id: string;
  action: "accept" | "edit" | "reply" | "ignore";
  reply?: string;
  edited?: string;
}): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(
    `${opts.workerUrl.replace(/\/$/, "")}/inbox/agent/${encodeURIComponent(opts.id)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: opts.action,
        reply: opts.reply,
        edited: opts.edited,
      }),
    },
  );
  return { ok: res.ok, status: res.status };
}
