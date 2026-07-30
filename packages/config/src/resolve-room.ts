import type { FluxyConfig, FluxyRoomConfig } from "./types.js";

const DEFAULT_ROOM_CONFIG: FluxyRoomConfig = {
  anonymous: true,
};

function templateSpecificity(key: string): number {
  if (!key.endsWith("*")) return Number.MAX_SAFE_INTEGER;
  return key.length - 1;
}

function matchesRoomKey(key: string, roomId: string): boolean {
  if (key === roomId) return true;
  if (key.endsWith("*")) {
    const prefix = key.slice(0, -1);
    return roomId.startsWith(prefix);
  }
  return false;
}

/** Resolve the most specific room config entry for a room id. */
export function resolveRoomConfig(
  config: FluxyConfig | null | undefined,
  roomId: string,
): FluxyRoomConfig {
  const rooms = config?.rooms;
  if (!rooms || !roomId) return { ...DEFAULT_ROOM_CONFIG };

  let bestKey: string | null = null;
  let bestScore = -1;

  for (const key of Object.keys(rooms)) {
    if (!matchesRoomKey(key, roomId)) continue;
    const score = templateSpecificity(key);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (!bestKey) return { ...DEFAULT_ROOM_CONFIG };
  return { ...DEFAULT_ROOM_CONFIG, ...rooms[bestKey] };
}

export function listRoomConfigKeys(config: FluxyConfig | null | undefined): string[] {
  return Object.keys(config?.rooms ?? {});
}
