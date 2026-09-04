const STORAGE_KEY = "fluxy-cli-session";

export interface CliSession {
  workerUrl: string;
  memberJwt?: string;
  publishableKey?: string;
  roomId: string;
  agentId: string;
  agentHandle: string;
  projectId: string;
  userId: string;
  projectName?: string;
  consoleUrl?: string;
}

function isCliSession(value: unknown): value is CliSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.workerUrl !== "string" || v.workerUrl.length === 0) return false;
  if (typeof v.roomId !== "string" || v.roomId.length === 0) return false;
  const hasMember = typeof v.memberJwt === "string" && v.memberJwt.length > 0;
  const hasPk = typeof v.publishableKey === "string" && v.publishableKey.startsWith("pk_");
  return hasMember || hasPk;
}

export function readCliSessionFromHash(): CliSession | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  const raw = new URLSearchParams(hash).get("fluxy_cli") || (hash.startsWith("fluxy_cli=") ? hash.slice("fluxy_cli=".length) : "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(decodeURIComponent(raw))) as unknown;
    if (!isCliSession(parsed)) return null;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return parsed;
  } catch {
    return null;
  }
}

export function loadCliSession(): CliSession | null {
  const fromHash = readCliSessionFromHash();
  if (fromHash) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromHash));
    return fromHash;
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as unknown;
    return isCliSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCliSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}
