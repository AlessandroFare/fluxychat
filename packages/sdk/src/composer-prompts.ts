export interface ComposerToolPromptOptions {
  topic: string;
  agentHandle?: string | null;
}

function cleanTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim();
}

export function buildDeepResearchPrompt({
  topic,
  agentHandle,
}: ComposerToolPromptOptions): string {
  const q = cleanTopic(topic);
  const handle = agentHandle?.replace(/^@/, "") || "assistant";
  return `@${handle} [deep-research] ${q}`;
}

export function buildWebSearchPrompt({
  topic,
  agentHandle,
}: ComposerToolPromptOptions): string {
  const q = cleanTopic(topic);
  const handle = agentHandle?.replace(/^@/, "") || "assistant";
  return `@${handle} [web-search] ${q}`;
}

export function buildImageGenerationCaption(prompt: string): string {
  const q = cleanTopic(prompt);
  return q ? `🎨 Generated image: ${q}` : "🎨 Generated image";
}
