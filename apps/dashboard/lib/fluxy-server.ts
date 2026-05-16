import { getWorkerUrl } from "@/lib/hosted-worker";

export { getWorkerUrl };

export function getConsoleApiKey(): string | null {
  const key = process.env.FLUXY_CONSOLE_API_KEY?.trim();
  return key || null;
}

interface MintTokenInput {
  userId: string;
  roles: string[];
  ttlSeconds?: number;
}

export interface MintTokenResult {
  token: string;
  expiresIn: number;
  claims: { sub: string; tid: string; roles: string[] };
}

export async function mintWorkerToken(
  input: MintTokenInput,
  apiKeyOverride?: string,
): Promise<MintTokenResult> {
  const apiKey = apiKeyOverride?.trim() || getConsoleApiKey();
  if (!apiKey) {
    throw new Error("API key is required to mint tokens (configure FLUXY_CONSOLE_API_KEY or pass project key).");
  }

  const res = await fetch(`${getWorkerUrl()}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": apiKey,
    },
    body: JSON.stringify({
      userId: input.userId,
      roles: input.roles,
      ttlSeconds: input.ttlSeconds ?? 3600,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as MintTokenResult & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Worker /auth/token failed (${res.status})`);
  }
  if (!json.token) {
    throw new Error("Worker did not return a token.");
  }
  return json;
}

export interface CreatedProject {
  id: string;
  name: string;
  created_at: string;
  apiKey: string;
}

export async function createWorkerProject(adminJwt: string, name: string): Promise<CreatedProject> {
  const res = await fetch(`${getWorkerUrl()}/admin/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminJwt}`,
    },
    body: JSON.stringify({ name }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    project?: CreatedProject;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || `Create project failed (${res.status})`);
  }
  if (!json.project?.apiKey) {
    throw new Error("Worker did not return a project.");
  }
  return json.project;
}

export async function listWorkerProjects(adminJwt: string) {
  const res = await fetch(`${getWorkerUrl()}/admin/projects`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    projects?: Array<{ id: string; name: string; created_at: string; plan?: unknown }>;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || `List projects failed (${res.status})`);
  }
  return json.projects ?? [];
}
