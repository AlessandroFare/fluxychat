import { clerkClient } from "@clerk/nextjs/server";

export interface FluxyClerkMetadata {
  fluxyProjectId?: string;
  fluxyProjectName?: string;
}

const PRIVATE_API_KEY = "fluxyProjectApiKey";

export async function syncFluxyProjectToClerk(
  clerkUserId: string,
  project: { id: string; name: string },
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      fluxyProjectId: project.id,
      fluxyProjectName: project.name,
    },
  });
}

/** Persist project id/name (public) and API key (private, server-only). */
export async function syncFluxyProjectSecretsToClerk(
  clerkUserId: string,
  project: { projectId: string; projectName: string; apiKey: string },
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      fluxyProjectId: project.projectId,
      fluxyProjectName: project.projectName,
    },
    privateMetadata: {
      [PRIVATE_API_KEY]: project.apiKey,
    },
  });
}

export async function readFluxyPrivateApiKey(clerkUserId: string): Promise<string | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const raw = user.privateMetadata?.[PRIVATE_API_KEY];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

export function readFluxyMetadata(
  publicMetadata: Record<string, unknown> | undefined,
): FluxyClerkMetadata {
  if (!publicMetadata) return {};
  const fluxyProjectId =
    typeof publicMetadata.fluxyProjectId === "string" ? publicMetadata.fluxyProjectId : undefined;
  const fluxyProjectName =
    typeof publicMetadata.fluxyProjectName === "string" ? publicMetadata.fluxyProjectName : undefined;
  return { fluxyProjectId, fluxyProjectName };
}
