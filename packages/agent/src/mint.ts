export interface MintTokenInput {
  baseUrl: string;
  apiKey: string;
  userId: string;
  roles?: string[];
  ttlSeconds?: number;
}

export interface MintTokenResult {
  token: string;
  expiresIn: number;
  claims: { sub: string; tid: string; roles: string[] };
}

export async function mintWorkerToken(input: MintTokenInput): Promise<MintTokenResult> {
  const base = input.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": input.apiKey,
    },
    body: JSON.stringify({
      userId: input.userId,
      roles: input.roles ?? ["member"],
      ttlSeconds: input.ttlSeconds ?? 3600,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as MintTokenResult & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Mint token failed (${res.status})`);
  }
  if (!json.token) {
    throw new Error("Worker did not return a token");
  }
  return json;
}
