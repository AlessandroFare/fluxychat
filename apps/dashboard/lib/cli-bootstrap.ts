import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { assistantRoomId, pickDefaultAssistantAgent } from "@/lib/assistant-room";
import {
  DEFAULT_ONBOARDING_AGENT_MODEL,
  DEFAULT_ONBOARDING_AGENT_PROVIDER,
} from "@/lib/agent-catalog";
import {
  fluxyUserIdFromClerk,
  provisionFluxyForClerkUser,
  resolveProjectApiKeyForClerkUser,
} from "@/lib/fluxy-provision";
import { ensurePublishableKey, getConsoleApiKey, mintWorkerToken } from "@/lib/fluxy-server";
import { getWorkerUrl } from "@/lib/hosted-worker";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import type { User } from "@clerk/nextjs/server";

export interface CliBootstrapPayload {
  workerUrl: string;
  memberJwt: string;
  adminJwt: string;
  roomId: string;
  agentId: string;
  agentHandle: string;
  projectId: string;
  userId: string;
  projectName: string;
  createdNewProject: boolean;
  publishableKey?: string;
}

export function isAllowedCliRedirectUri(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

async function ensureAssistantAgent(
  workerUrl: string,
  adminJwt: string,
): Promise<{ id: string; handle: string }> {
  const listJson = await fetchWorkerJson<{
    agents?: Array<{ id: string; name: string; handle?: string | null }>;
  }>(`${workerUrl}/agents`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
  });
  const existing = pickDefaultAssistantAgent(listJson.agents ?? []);
  if (existing?.id) {
    const handle = existing.handle?.replace(/^@/, "") || "assistant";
    return { id: existing.id, handle: `@${handle}` };
  }

  const json = await fetchWorkerJson<{ agent: { id: string; handle?: string | null } }>(
    `${workerUrl}/agents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({
        name: "Assistant",
        handle: "assistant",
        provider: DEFAULT_ONBOARDING_AGENT_PROVIDER,
        model: DEFAULT_ONBOARDING_AGENT_MODEL,
        capabilities: ["chat"],
      }),
    },
  );
  return { id: json.agent.id, handle: "@assistant" };
}

export async function buildCliBootstrapForClerkUser(
  clerkUserId: string,
  user: User | null,
): Promise<CliBootstrapPayload> {
  const workerUrl = getWorkerUrl();
  const provisioned = await provisionFluxyForClerkUser(clerkUserId, user, {
    createProject: true,
  });
  const projectId = provisioned.activeProject?.id || provisioned.projectId;
  const userId = fluxyUserIdFromClerk(clerkUserId);
  const apiKeyForMember =
    (await resolveProjectApiKeyForClerkUser(clerkUserId)) || getConsoleApiKey();
  if (!apiKeyForMember) {
    throw new Error("Could not mint a member token for this account.");
  }
  const memberMint = await mintWorkerToken(
    { userId, roles: ["member"], ttlSeconds: 7200 },
    apiKeyForMember,
  );

  const roomResult = await ensureAssistantRoom({
    workerUrl,
    memberJwt: memberMint.token,
    memberUserId: userId,
    projectId,
    adminJwt: provisioned.adminJwt,
  });
  const agent = await ensureAssistantAgent(workerUrl, provisioned.adminJwt);
  const publishableKey = await ensurePublishableKey(provisioned.adminJwt, projectId);

  return {
    workerUrl,
    memberJwt: memberMint.token,
    adminJwt: provisioned.adminJwt,
    roomId: roomResult.room.id || assistantRoomId(projectId),
    agentId: agent.id,
    agentHandle: agent.handle,
    projectId,
    userId,
    projectName: provisioned.activeProject?.name || "My project",
    createdNewProject: provisioned.createdNewProject,
    publishableKey: publishableKey ?? undefined,
  };
}
