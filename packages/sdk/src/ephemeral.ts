import { type ThreadAdapter, type AdapterEphemeralResult, type EphemeralMessage, type PostEphemeralOptions } from "./adapter-types";

export type { AdapterEphemeralResult, EphemeralMessage, PostEphemeralOptions } from "./adapter-types";

export async function postEphemeral(
  adapter: ThreadAdapter,
  threadId: string,
  userId: string,
  content: string,
  options?: PostEphemeralOptions
): Promise<EphemeralMessage | null> {
  if (adapter.postEphemeral) {
    const result = await adapter.postEphemeral(threadId, userId, content);
    return { id: result.id, threadId: result.threadId, usedFallback: false };
  }

  if (options?.fallbackToDM !== false && adapter.openDM) {
    const dmThreadId = await adapter.openDM(userId);
    const msg = await adapter.postMessage(dmThreadId, content);
    return { id: msg.id, threadId: dmThreadId, usedFallback: true };
  }

  return null;
}
