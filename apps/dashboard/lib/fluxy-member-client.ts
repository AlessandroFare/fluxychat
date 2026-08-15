import { FluxyChatClient } from "@fluxy-chat/sdk";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { readJwtSub } from "@/lib/jwt-claims";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

export interface CreateMemberFluxyClientInput {
  memberJwt: string;
  /** Hint when JWT `sub` is unavailable (UI-only decode). */
  memberUserId?: string;
  clerkUserId?: string | null;
  workerUrl?: string;
}

/**
 * Build a room WebSocket client whose `userId` matches JWT `sub` (required for WS auth).
 */
export function createMemberFluxyClient(input: CreateMemberFluxyClientInput): FluxyChatClient | null {
  const token = input.memberJwt.trim();
  if (!token) return null;

  const userId =
    readJwtSub(token)?.trim() ||
    input.memberUserId?.trim() ||
    (input.clerkUserId ? fluxyUserIdFromClerk(input.clerkUserId) : "") ||
    "dashboard";

  return new FluxyChatClient({
    baseUrl: (input.workerUrl ?? getPublicWorkerUrl()).replace(/\/$/, ""),
    userId,
    token,
  });
}
