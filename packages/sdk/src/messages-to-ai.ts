import type { FluxyChatMessage, FluxyChatAttachment } from "./index";

export interface AiTextPart {
  text: string;
  type: "text";
}

export interface AiImagePart {
  image: string | URL;
  mediaType?: string;
  type: "image";
}

export interface AiFilePart {
  data: string | URL;
  filename?: string;
  mediaType: string;
  type: "file";
}

export type AiMessagePart = AiTextPart | AiImagePart | AiFilePart;

export type AiMessage = AiUserMessage | AiAssistantMessage;

export interface AiUserMessage {
  content: string | AiMessagePart[];
  role: "user";
}

export interface AiAssistantMessage {
  content: string;
  role: "assistant";
}

export interface ToAiMessagesOptions {
  /** User ID of the bot/agent. Messages from this user become assistant messages. */
  botUserId?: string;
  /** When true, prefixes user messages with "[username]: " for multi-user context. */
  includeNames?: boolean;
  /**
   * Called when an attachment type is not supported (video, audio, etc.).
   * Defaults to console.warn.
   */
  onUnsupportedAttachment?: (attachment: FluxyChatAttachment, message: FluxyChatMessage) => void;
  /**
   * Called for each message after default processing.
   * Return the message (modified or as-is) to include it, or null to skip it.
   */
  transformMessage?: (
    aiMessage: AiMessage,
    source: FluxyChatMessage
  ) => AiMessage | null | Promise<AiMessage | null>;
}

const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
];

function isTextMimeType(mimeType: string): boolean {
  return TEXT_MIME_PREFIXES.some(
    (prefix) => mimeType === prefix || mimeType.startsWith(prefix)
  );
}

function attachmentToPart(
  att: FluxyChatAttachment
): AiMessagePart | null {
  if (att.kind === "image") {
    return {
      type: "file",
      data: att.url,
      mediaType: att.contentType ?? "image/png",
      filename: att.name,
    };
  }

  if (att.kind === "file" && att.contentType && isTextMimeType(att.contentType)) {
    return {
      type: "file",
      data: att.url,
      filename: att.name,
      mediaType: att.contentType,
    };
  }

  return null;
}

export async function toAiMessages(
  messages: FluxyChatMessage[],
  options?: ToAiMessagesOptions
): Promise<AiMessage[]> {
  const botUserId = options?.botUserId;
  const includeNames = options?.includeNames ?? false;
  const transformMessage = options?.transformMessage;
  const onUnsupported =
    options?.onUnsupportedAttachment ??
    ((att: FluxyChatAttachment) => {
      console.warn(
        `toAiMessages: unsupported attachment kind "${att.kind}"${att.name ? ` (${att.name})` : ""} — skipped`
      );
    });

  const sorted = [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const filtered = sorted.filter((msg) => msg.content.trim());

  const results = await Promise.all(
    filtered.map(async (msg) => {
      const role: "user" | "assistant" =
        botUserId != null && (msg.senderId === botUserId || msg.userId === botUserId) ? "assistant" : "user";

      let textContent =
        includeNames && role === "user"
          ? `[${msg.senderId ?? msg.userId}]: ${msg.content}`
          : msg.content;

      if (msg.preview) {
        const linkParts: string[] = [msg.preview.url];
        if (msg.preview.title) linkParts.push(`Title: ${msg.preview.title}`);
        if (msg.preview.description) linkParts.push(`Description: ${msg.preview.description}`);
        textContent += `\n\nLinks:\n${linkParts.join("\n")}`;
      }

      let aiMessage: AiMessage;
      if (role === "user") {
        const attachmentParts: AiMessagePart[] = [];
        for (const att of msg.attachments ?? []) {
          const part = attachmentToPart(att);
          if (part) {
            attachmentParts.push(part);
          } else {
            onUnsupported(att, msg);
          }
        }

        if (attachmentParts.length > 0) {
          aiMessage = {
            role,
            content: [
              { type: "text" as const, text: textContent },
              ...attachmentParts,
            ],
          };
        } else {
          aiMessage = { role, content: textContent };
        }
      } else {
        aiMessage = { role, content: textContent };
      }

      if (transformMessage) {
        return { result: await transformMessage(aiMessage, msg), source: msg };
      }
      return { result: aiMessage, source: msg };
    })
  );

  return results
    .filter(
      (r): r is { result: AiMessage; source: FluxyChatMessage } => r.result != null
    )
    .map((r) => r.result);
}
