import type { User } from "@clerk/nextjs/server";
import {
  readFluxyMetadata,
  readFluxyPrivateApiKey,
  syncFluxyProjectSecretsToClerk,
} from "@/lib/clerk-fluxy-metadata";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import {
  createWorkerProject,
  getConsoleApiKey,
  listWorkerProjects,
  mintWorkerToken,
} from "@/lib/fluxy-server";

export { fluxyUserIdFromClerk };

export interface ProvisionResult {
  adminJwt: string;
  expiresIn: number;
  projectId: string;
  activeProject: {
    id: string;
    name: string;
    created_at: string;
    apiKey?: string;
  } | null;
  createdNewProject: boolean;
}

function defaultProjectName(user: User | null): string {
  const fromName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  if (fromName) return `${fromName}'s project`.slice(0, 64);
  const email = user?.primaryEmailAddress?.emailAddress;
  if (email) return `${email.split("@")[0]}'s project`.slice(0, 64);
  return "My first project";
}

async function mintAdminForProject(
  clerkUserId: string,
  projectApiKey: string,
): Promise<{ token: string; expiresIn: number; projectId: string }> {
  const minted = await mintWorkerToken(
    {
      userId: fluxyUserIdFromClerk(clerkUserId),
      roles: ["owner", "admin"],
      ttlSeconds: 7200,
    },
    projectApiKey,
  );
  return {
    token: minted.token,
    expiresIn: minted.expiresIn,
    projectId: minted.claims.tid,
  };
}

/**
 * Idempotent hosted provisioning: one Clerk user → one Worker project (API key in Clerk private metadata).
 */
export async function provisionFluxyForClerkUser(
  clerkUserId: string,
  user: User | null,
  options?: { createProject?: boolean; projectName?: string },
): Promise<ProvisionResult> {
  const bootstrapKey = getConsoleApiKey();
  if (!bootstrapKey) {
    throw new Error(
      "Server missing FLUXY_CONSOLE_API_KEY (bootstrap project key on the hosted Worker).",
    );
  }

  const publicMeta = readFluxyMetadata(user?.publicMetadata as Record<string, unknown> | undefined);
  const storedApiKey = await readFluxyPrivateApiKey(clerkUserId);
  const pinnedProjectId = process.env.FLUXY_CONSOLE_PROJECT_ID?.trim();

  if (storedApiKey && publicMeta.fluxyProjectId) {
    const minted = await mintAdminForProject(clerkUserId, storedApiKey);
    return {
      adminJwt: minted.token,
      expiresIn: minted.expiresIn,
      projectId: minted.projectId,
      activeProject: {
        id: publicMeta.fluxyProjectId,
        name: publicMeta.fluxyProjectName || "My project",
        created_at: new Date().toISOString(),
      },
      createdNewProject: false,
    };
  }

  const shouldCreate = options?.createProject !== false;

  if (!shouldCreate) {
    const bootstrapMint = await mintAdminForProject(clerkUserId, bootstrapKey);
    const projects = await listWorkerProjects(bootstrapMint.token);
    const pick = pinnedProjectId
      ? projects.find((p) => p.id === pinnedProjectId) ?? null
      : projects[0] ?? null;

    if (!pick) {
      return {
        adminJwt: bootstrapMint.token,
        expiresIn: bootstrapMint.expiresIn,
        projectId: bootstrapMint.projectId,
        activeProject: null,
        createdNewProject: false,
      };
    }

    return {
      adminJwt: bootstrapMint.token,
      expiresIn: bootstrapMint.expiresIn,
      projectId: bootstrapMint.projectId,
      activeProject: {
        id: pick.id,
        name: pick.name,
        created_at: pick.created_at,
      },
      createdNewProject: false,
    };
  }

  const bootstrapMint = await mintAdminForProject(clerkUserId, bootstrapKey);
  const created = await createWorkerProject(
    bootstrapMint.token,
    options?.projectName?.trim() || defaultProjectName(user),
  );

  await syncFluxyProjectSecretsToClerk(clerkUserId, {
    projectId: created.id,
    projectName: created.name,
    apiKey: created.apiKey,
  });

  const tenantMint = await mintAdminForProject(clerkUserId, created.apiKey);

  return {
    adminJwt: tenantMint.token,
    expiresIn: tenantMint.expiresIn,
    projectId: tenantMint.projectId,
    activeProject: {
      id: created.id,
      name: created.name,
      created_at: created.created_at,
      apiKey: created.apiKey,
    },
    createdNewProject: true,
  };
}

export async function resolveProjectApiKeyForClerkUser(clerkUserId: string): Promise<string | null> {
  const stored = await readFluxyPrivateApiKey(clerkUserId);
  if (stored) return stored;
  return getConsoleApiKey();
}
