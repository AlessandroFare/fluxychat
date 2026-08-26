export interface FluxyPresence {
  cursor?: { x: number; y: number } | null;
  selection?: unknown;
  /** Workflow / copilot status (LB-AICOLL). Ephemeral. */
  agentStatus?: string | null;
  [key: string]: unknown;
}

const PATCH_MAX_BYTES = 2048;

export function parsePresencePatchEvent(event: unknown): FluxyPresence | null {
  if (!event || typeof event !== "object") return null;
  const rec = event as Record<string, unknown>;
  if (rec.type !== "presence_patch") return null;
  const data = rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)
    ? (rec.data as Record<string, unknown>)
    : rec;
  const patch: FluxyPresence = {};
  if ("cursor" in data) {
    if (data.cursor === null) patch.cursor = null;
    else if (data.cursor && typeof data.cursor === "object") {
      const cursor = data.cursor as Record<string, unknown>;
      const x = Number(cursor.x);
      const y = Number(cursor.y);
      if (Number.isFinite(x) && Number.isFinite(y)) patch.cursor = { x, y };
    }
  }
  if ("selection" in data) {
    patch.selection = data.selection;
  }
  if ("agentStatus" in data) {
    if (data.agentStatus === null) patch.agentStatus = null;
    else if (typeof data.agentStatus === "string") {
      patch.agentStatus = data.agentStatus.slice(0, 64);
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildPresencePatchOutbound(patch: Partial<FluxyPresence>): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  if ("cursor" in patch) data.cursor = patch.cursor ?? null;
  if ("selection" in patch) data.selection = patch.selection ?? null;
  if ("agentStatus" in patch) data.agentStatus = patch.agentStatus ?? null;
  if (Object.keys(data).length === 0) return null;
  const encoded = JSON.stringify(data);
  if (encoded.length > PATCH_MAX_BYTES) return null;
  return { type: "presence_patch", data };
}
