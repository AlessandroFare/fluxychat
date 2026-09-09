/**
 * OpenAI Chat Completions (and many gateways) reject non-string `content`
 * unless the model is known to accept vision parts.
 */
import { getModelCapabilities } from "./llm-model-catalog.js";

export function stringifyLlmContent(content) {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    const bits = [];
    for (const part of content) {
      if (typeof part === "string") {
        bits.push(part);
        continue;
      }
      if (!part || typeof part !== "object") continue;
      if (part.type === "text" && typeof part.text === "string") {
        bits.push(part.text);
        continue;
      }
      if (part.type === "image_url") {
        bits.push("[image]");
        continue;
      }
      if (part.type === "tool_result") {
        bits.push(stringifyLlmContent(part.content));
        continue;
      }
      bits.push(JSON.stringify(part));
    }
    return bits.filter(Boolean).join("\n");
  }
  if (typeof content === "object") return JSON.stringify(content);
  return String(content);
}

export function sanitizeOpenAiCompatibleMessages(messages, { allowVision = false } = {}) {
  if (!Array.isArray(messages)) return [];
  return messages.map((msg) => {
    if (!msg || typeof msg !== "object") return msg;
    const next = { ...msg };
    const hasToolCalls = Array.isArray(next.tool_calls) && next.tool_calls.length > 0;
    if (allowVision && Array.isArray(next.content)) {
      next.content = next.content.map((part) => {
        if (part && typeof part === "object" && part.type === "text") {
          return { ...part, text: stringifyLlmContent(part.text) };
        }
        return part;
      });
    } else {
      next.content = stringifyLlmContent(next.content);
    }
    if (hasToolCalls && (next.content == null || next.content === undefined)) {
      next.content = "";
    }
    return next;
  });
}

export function openAiMessagesForModel(model, messages) {
  const allowVision = Boolean(getModelCapabilities(model, "openai-compatible").imageInput);
  return sanitizeOpenAiCompatibleMessages(messages, { allowVision });
}
