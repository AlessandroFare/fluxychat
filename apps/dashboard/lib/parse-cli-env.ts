export interface ParsedCliEnv {
  workerUrl?: string;
  memberJwt?: string;
  roomId?: string;
  agentId?: string;
  agentHandle?: string;
  projectId?: string;
  consoleUrl?: string;
  userId?: string;
}

/** Parse `.env` output from `create-fluxy-chat --full` → `pnpm setup`. */
export function parseCliEnvContent(content: string): ParsedCliEnv {
  const out: ParsedCliEnv = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    switch (key) {
      case "VITE_FLUXYCHAT_WORKER_URL":
        out.workerUrl = value;
        break;
      case "VITE_FLUXYCHAT_MEMBER_JWT":
        out.memberJwt = value;
        break;
      case "VITE_FLUXYCHAT_ROOM_ID":
        out.roomId = value;
        break;
      case "VITE_FLUXYCHAT_AGENT_ID":
        out.agentId = value;
        break;
      case "VITE_FLUXYCHAT_AGENT_HANDLE":
        out.agentHandle = value;
        break;
      case "VITE_FLUXYCHAT_PROJECT_ID":
        out.projectId = value;
        break;
      case "VITE_FLUXYCHAT_CONSOLE_URL":
        out.consoleUrl = value;
        break;
      case "VITE_FLUXYCHAT_USER_ID":
        out.userId = value;
        break;
      default:
        break;
    }
  }
  return out;
}

export function validateCliEnvImport(parsed: ParsedCliEnv): string | null {
  if (!parsed.memberJwt?.trim()) return "Missing VITE_FLUXYCHAT_MEMBER_JWT";
  if (!parsed.roomId?.trim()) return "Missing VITE_FLUXYCHAT_ROOM_ID";
  if (!parsed.projectId?.trim()) return "Missing VITE_FLUXYCHAT_PROJECT_ID";
  return null;
}
