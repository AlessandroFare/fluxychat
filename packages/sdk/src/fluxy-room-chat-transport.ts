/**
 * Duck-typed Vercel AI SDK 7 `ChatTransport` over a FluxyChat room.
 * Does not import `ai`. Room LLM hibernate still drops in-flight generation.
 */

import type { FluxyChatClient } from "./fluxy-chat-client";

export type FluxyAiToolApprovalResponsePart = {
  type: "tool-approval-response";
  approvalId: string;
  approved: boolean;
  reason?: string;
  signature?: string;
};

export type FluxyAiUiMessage = {
  role?: string;
  content?: string;
  parts?: Array<
    | { type?: string; text?: string }
    | FluxyAiToolApprovalResponsePart
    | Record<string, unknown>
  >;
};

export type FluxyAiUiMessageChunk =
  | { type: "text-start"; id: string; requestId?: string }
  | { type: "text-delta"; id: string; delta: string; requestId?: string }
  | { type: "text-end"; id: string; requestId?: string }
  | {
      type: "tool-approval-request";
      approvalId: string;
      toolCallId: string;
      toolName: string;
      input?: unknown;
      signature?: string;
      requestId?: string;
    }
  | { type: "finish"; finishReason: string; requestId?: string };

export type FluxyRoomChatTransportOptions = {
  client: FluxyChatClient;
  roomId: string;
  agentId: string;
};

export function lastUserText(messages: FluxyAiUiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role && msg.role !== "user") continue;
    if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
    const parts = Array.isArray(msg.parts) ? msg.parts : [];
    const text = parts
      .filter((p) => {
        const type = (p as { type?: string }).type;
        if (type === "tool-approval-response" || type === "tool-approval-request") return false;
        return type === "text" || type == null;
      })
      .map((p) => (p as { text?: string }).text)
      .filter((t): t is string => typeof t === "string")
      .join("");
    if (text.trim()) return text.trim();
  }
  return "";
}

export function lastToolApprovalResponse(
  messages: FluxyAiUiMessage[],
): FluxyAiToolApprovalResponsePart | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parts = messages[i]?.parts;
    if (!Array.isArray(parts)) continue;
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j] as { type?: string };
      if (part?.type === "tool-approval-response" && typeof (part as FluxyAiToolApprovalResponsePart).approvalId === "string") {
        return part as FluxyAiToolApprovalResponsePart;
      }
    }
  }
  return null;
}

export function encodeUiMessageTextStream(
  text: string,
  id = "0",
  requestId?: string,
): ReadableStream<FluxyAiUiMessageChunk> {
  const rid = requestId?.trim() || undefined;
  const chunks: FluxyAiUiMessageChunk[] = [
    { type: "text-start", id, ...(rid ? { requestId: rid } : {}) },
    { type: "text-delta", id, delta: text, ...(rid ? { requestId: rid } : {}) },
    { type: "text-end", id, ...(rid ? { requestId: rid } : {}) },
    { type: "finish", finishReason: "stop", ...(rid ? { requestId: rid } : {}) },
  ];
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

export function encodeToolApprovalRequestStream(entry: {
  id: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: unknown;
  signature?: string;
  requestId?: string;
}): ReadableStream<FluxyAiUiMessageChunk> {
  const rid = entry.requestId?.trim() || undefined;
  const chunks: FluxyAiUiMessageChunk[] = [
    {
      type: "tool-approval-request",
      approvalId: entry.id,
      toolCallId: entry.toolCallId || entry.id,
      toolName: entry.toolName || "tool",
      input: entry.toolInput,
      signature: entry.signature,
      ...(rid ? { requestId: rid } : {}),
    },
    { type: "finish", finishReason: "tool-calls", ...(rid ? { requestId: rid } : {}) },
  ];
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/**
 * Maps AI SDK 7 `useChat({ transport })` onto `invokeAgent` + room HITL.
 * `addToolApprovalResponse` lands as a `tool-approval-response` part; we POST it to the room.
 * `chatId` is ignored; the session is the room.
 */
export class FluxyRoomChatTransport {
  readonly client: FluxyChatClient;
  readonly roomId: string;
  readonly agentId: string;

  constructor(options: FluxyRoomChatTransportOptions) {
    this.client = options.client;
    this.roomId = options.roomId;
    this.agentId = options.agentId;
  }

  async sendMessages(options: {
    trigger?: string;
    chatId?: string;
    messageId?: string;
    messages: FluxyAiUiMessage[];
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<FluxyAiUiMessageChunk>> {
    const approval = lastToolApprovalResponse(options.messages);
    if (approval?.approvalId) {
      await this.client.decideHitl(approval.approvalId, approval.approved ? "approve" : "deny", {
        note: approval.reason,
        vercelSignature: approval.signature,
        abortSignal: options.abortSignal,
      });
    }

    const requestId = String(options.chatId || options.messageId || "").trim() || undefined;
    const content = lastUserText(options.messages);
    if (content) {
      const result = await this.client.invokeAgentRest(this.agentId, this.roomId, content, {
        abortSignal: options.abortSignal,
      });
      const text = typeof result.message?.content === "string" ? result.message.content : "";
      const pending = await this.client.listHitlApprovals(this.roomId, { abortSignal: options.abortSignal });
      const first = pending[0];
      if (first?.id) return encodeToolApprovalRequestStream({ ...first, requestId });
      return encodeUiMessageTextStream(text, "0", requestId);
    }

    const pending = await this.client.listHitlApprovals(this.roomId, { abortSignal: options.abortSignal });
    const first = pending[0];
    if (first?.id) return encodeToolApprovalRequestStream({ ...first, requestId });
    return encodeUiMessageTextStream("", "0", requestId);
  }

  async reconnectToStream(options: {
    chatId?: string;
    abortSignal?: AbortSignal;
    fromOffset?: number;
  }): Promise<ReadableStream<FluxyAiUiMessageChunk> | null> {
    const pending = await this.client.listHitlApprovals(this.roomId).catch(() => []);
    const requestId = String(options.chatId || "").trim() || undefined;
    if (pending[0]?.id) return encodeToolApprovalRequestStream({ ...pending[0], requestId });
    const active = await this.client.listActiveAiStreams(this.roomId);
    const hit = active.find((s) => s.active !== false) ?? active[0];
    if (!hit?.streamId) return null;
    const resumed = await this.client.resumeAiStream(hit.streamId, {
      fromOffset: options.fromOffset,
    });
    if (!resumed) return null;
    if (resumed.caughtUp) return encodeUiMessageTextStream("", "0", requestId);
    if (!resumed.content && !resumed.active) return null;
    return encodeUiMessageTextStream(resumed.content || "", "0", requestId);
  }

  /** Any room member can stop the in-flight agent stream (other tab included). */
  abortStream(options?: { agentId?: string; messageId?: number }): Promise<{ ok: boolean; error?: string }> {
    const agentId = options?.agentId ?? this.agentId;
    return this.client.abortRoomStream(this.roomId, {
      userId: agentId,
      messageId: options?.messageId,
    });
  }
}
