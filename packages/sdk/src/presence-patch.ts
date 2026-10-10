export type FluxyUiLocation = string | { surface: string; id: string };

export interface FluxyPresence {
  cursor?: { x: number; y: number } | null;
  selection?: unknown;
  /** Workflow / copilot status (LB-AICOLL). Ephemeral. */
  agentStatus?: string | null;
  /** Which slide/field the user is on. Not GPS. */
  uiLocation?: FluxyUiLocation | null;
  [key: string]: unknown;
}

function parseUiLocation(value: unknown): FluxyUiLocation | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") {
    const text = value.trim().slice(0, 128);
    return text || undefined;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    const surface = typeof rec.surface === "string" ? rec.surface.trim().slice(0, 64) : "";
    const id = typeof rec.id === "string" ? rec.id.trim().slice(0, 64) : "";
    if (surface && id) return { surface, id };
  }
  return undefined;
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
  const locRaw = "uiLocation" in data ? data.uiLocation : data.ui_location;
  if ("uiLocation" in data || "ui_location" in data) {
    const loc = parseUiLocation(locRaw);
    if (loc !== undefined) patch.uiLocation = loc;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildPresencePatchOutbound(patch: Partial<FluxyPresence>): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};
  if ("cursor" in patch) data.cursor = patch.cursor ?? null;
  if ("selection" in patch) data.selection = patch.selection ?? null;
  if ("agentStatus" in patch) data.agentStatus = patch.agentStatus ?? null;
  if ("uiLocation" in patch) data.uiLocation = patch.uiLocation ?? null;
  if (Object.keys(data).length === 0) return null;
  const encoded = JSON.stringify(data);
  if (encoded.length > PATCH_MAX_BYTES) return null;
  return { type: "presence_patch", data };
}
