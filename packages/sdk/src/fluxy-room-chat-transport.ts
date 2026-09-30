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
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | {
      type: "tool-approval-request";
      approvalId: string;
      toolCallId: string;
      toolName: string;
      input?: unknown;
      signature?: string;
    }
  | { type: "finish"; finishReason: string };

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

export function encodeUiMessageTextStream(text: string, id = "0"): ReadableStream<FluxyAiUiMessageChunk> {
  const chunks: FluxyAiUiMessageChunk[] = [
    { type: "text-start", id },
    { type: "text-delta", id, delta: text },
    { type: "text-end", id },
    { type: "finish", finishReason: "stop" },
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
}): ReadableStream<FluxyAiUiMessageChunk> {
  const chunks: FluxyAiUiMessageChunk[] = [
    {
      type: "tool-approval-request",
      approvalId: entry.id,
      toolCallId: entry.toolCallId || entry.id,
      toolName: entry.toolName || "tool",
      input: entry.toolInput,
      signature: entry.signature,
    },
    { type: "finish", finishReason: "tool-calls" },
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

    const content = lastUserText(options.messages);
    if (content) {
      const result = await this.client.invokeAgentRest(this.agentId, this.roomId, content, {
        abortSignal: options.abortSignal,
      });
      const text = typeof result.message?.content === "string" ? result.message.content : "";
      const pending = await this.client.listHitlApprovals(this.roomId, { abortSignal: options.abortSignal });
      const first = pending[0];
      if (first?.id) return encodeToolApprovalRequestStream(first);
      return encodeUiMessageTextStream(text);
    }

    const pending = await this.client.listHitlApprovals(this.roomId, { abortSignal: options.abortSignal });
    const first = pending[0];
    if (first?.id) return encodeToolApprovalRequestStream(first);
    return encodeUiMessageTextStream("");
  }

  async reconnectToStream(options: {
    chatId?: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<FluxyAiUiMessageChunk> | null> {
    void options;
    const pending = await this.client.listHitlApprovals(this.roomId).catch(() => []);
    if (pending[0]?.id) return encodeToolApprovalRequestStream(pending[0]);
    const active = await this.client.listActiveAiStreams(this.roomId);
    const hit = active.find((s) => s.active !== false) ?? active[0];
    if (!hit?.streamId) return null;
    const resumed = await this.client.resumeAiStream(hit.streamId);
    if (!resumed) return null;
    if (!resumed.content && !resumed.active) return null;
    return encodeUiMessageTextStream(resumed.content || "");
  }
}
