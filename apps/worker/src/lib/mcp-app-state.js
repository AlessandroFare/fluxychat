const MAX_STATE_BYTES = 24_000;

export function mcpAppStateKey(projectId, roomId, appId) {
  return `mcp-app-state:${projectId}:${roomId}:${appId}`;
}

export function normalizeMcpAppId(appId) {
  const id = String(appId || "").trim();
  if (!id || id.length > 200) return null;
  if (!/^ui:\/\/[a-zA-Z0-9._:/-]+$/.test(id) && !/^[a-zA-Z0-9._:-]+$/.test(id)) return null;
  return id;
}

export function mergeMcpAppState(current, patch, { replace = false } = {}) {
  const base = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  const nextPatch = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  return replace ? { ...nextPatch } : { ...base, ...nextPatch };
}

export async function getMcpAppSharedState(env, { projectId, roomId, appId }) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return { state: {}, version: 0, updatedAt: null, updatedBy: null };
  const raw = await kv.get(mcpAppStateKey(projectId, roomId, appId), { type: "json" });
  if (!raw || typeof raw !== "object") {
    return { state: {}, version: 0, updatedAt: null, updatedBy: null };
  }
  return {
    state: raw.state && typeof raw.state === "object" ? raw.state : {},
    version: Number(raw.version) || 0,
    updatedAt: raw.updatedAt || null,
    updatedBy: raw.updatedBy || null,
  };
}

export async function putMcpAppSharedState(env, {
  projectId,
  roomId,
  appId,
  patch,
  replace = false,
  userId,
}) {
  const prev = await getMcpAppSharedState(env, { projectId, roomId, appId });
  const state = mergeMcpAppState(prev.state, patch, { replace });
  const encoded = JSON.stringify(state);
  if (encoded.length > MAX_STATE_BYTES) {
    return { ok: false, error: "state_too_large" };
  }
  const record = {
    state,
    version: prev.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: userId || null,
  };
  const kv = env.RATE_LIMIT_KV;
  if (kv) {
    await kv.put(mcpAppStateKey(projectId, roomId, appId), JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  }
  try {
    const { syncMcpAppStateToRoom } = await import("./yjs-mcp-app-state.js");
    await syncMcpAppStateToRoom(env, {
      projectId,
      roomId,
      userId,
      record: { appId, ...record },
    });
  } catch {
    /* Yjs replica is best-effort */
  }
  try {
    const { fanoutRoomInternal } = await import("./room-shard.js");
    await fanoutRoomInternal(env, projectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "mcp_app_state",
        roomId,
        appId,
        state: record.state,
        version: record.version,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      }),
    });
  } catch {
    /* ignore */
  }
  return { ok: true, ...record };
}
