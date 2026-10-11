export interface ComposerToolPromptOptions {
  topic: string
  agentHandle?: string | null
}

function cleanTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim()
}

/** Structured deep-research invoke text for agent rooms. */
export function buildDeepResearchPrompt({
  topic,
  agentHandle,
}: ComposerToolPromptOptions): string {
  const q = cleanTopic(topic)
  const handle = agentHandle?.replace(/^@/, "") || "assistant"
  return `@${handle} [deep-research] ${q}`
}

/** Web search invoke text — instructs the agent to search for current information. */
export function buildWebSearchPrompt({
  topic,
  agentHandle,
}: ComposerToolPromptOptions): string {
  const q = cleanTopic(topic)
  const handle = agentHandle?.replace(/^@/, "") || "assistant"
  return `@${handle} [web-search] ${q}`
}

/** Image generation caption posted alongside the generated attachment. */
export function buildImageGenerationCaption(prompt: string): string {
  const q = cleanTopic(prompt)
  return q ? `🎨 Generated image: ${q}` : "🎨 Generated image"
}
