/**
 * Native push backends for HITL. Payload title/body stay generic; details load after auth.
 * Button actions must POST a one-time token — never GET.
 */

export const PUSH_BACKENDS = ["expo", "fcm-v1", "apns"] as const;
export type PushBackend = (typeof PUSH_BACKENDS)[number];

export interface PushDeviceRecord {
  userId: string;
  token: string;
  backend: PushBackend;
  rotatedAt?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Deep link path only, e.g. /rooms/abc — no secrets. */
  path: string;
  interruptionLevel?: "passive" | "active" | "time-sensitive" | "critical";
  category?: "hitl_approve_deny";
}

export interface PushProvider {
  backend: PushBackend;
  send(device: PushDeviceRecord, message: PushMessage): Promise<{ ok: boolean; receiptId?: string }>;
}

export function createPushProvider(backend: PushBackend, send: PushProvider["send"]): PushProvider {
  if (!PUSH_BACKENDS.includes(backend)) throw new Error("unknown_push_backend");
  return { backend, send };
}

export function hitlPushCopy(): Pick<PushMessage, "title" | "body" | "interruptionLevel" | "category"> {
  return {
    title: "Approval waiting",
    body: "Open the app to review. Details are not in this notification.",
    interruptionLevel: "time-sensitive",
    category: "hitl_approve_deny",
  };
}
