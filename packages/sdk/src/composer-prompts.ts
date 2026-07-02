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
  return `@${handle} [deep-research] Conduct thorough, multi-step research on: ${q}. Structure your answer with: (1) executive summary, (2) key findings with evidence, (3) sources or references when available, (4) open questions and limitations.`;
}

export function buildWebSearchPrompt({
  topic,
  agentHandle,
}: ComposerToolPromptOptions): string {
  const q = cleanTopic(topic);
  const handle = agentHandle?.replace(/^@/, "") || "assistant";
  return `@${handle} [web-search] Search the web for current, factual information about: ${q}. Summarize findings, cite sources with URLs when possible, and note when information may be outdated.`;
}

export function buildImageGenerationCaption(prompt: string): string {
  const q = cleanTopic(prompt);
  return q ? `🎨 Generated image: ${q}` : "🎨 Generated image";
}
