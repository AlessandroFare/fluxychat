/**
 * Worker-only AI/runtime helpers — not implemented in the browser bundle.
 * Import from `@fluxy-chat/sdk/worker-runtime` in your Cloudflare Worker or Node agent service.
 */

export {
  buildToolsWithOverrides,
  getEffectiveApproval,
  isToolEnabled,
  validateOverride,
} from "./tool-overrides";

export {
  createToolContextManager,
  createScopedToolContext,
} from "./tool-context";

export {
  createStreamResumptionStore,
} from "./stream-resumption";

export {
  createApprovalStore,
  createApprovalGate,
} from "./hitl-approval";

export {
  createLoopController,
  LOOP_PRESETS,
} from "./loop-control";

export {
  createSandboxManager,
  executeInSandbox,
} from "./sandbox";

export {
  createPlatformAdapter,
  createBotDeploymentManager,
} from "./cross-platform";

export {
  createProviderToolRegistry,
  PROVIDER_TOOL_SETS,
  providerToolsToSchema,
} from "./provider-tools";

export { useObject } from "./data-parts";

export {
  structuredOutputPrompt,
  parseStructuredOutput,
  validateAgainstSchema,
  withStructuredOutput,
} from "./structured-output";

export {
  createImageGenerator,
  IMAGE_GENERATION_TOOL,
} from "./image-generation";

export {
  createTextToSpeech,
  TTS_TOOL,
} from "./tts";

export {
  createPromptRenderer,
  createPromptTemplateRegistry,
  BUILTIN_PROMPT_TEMPLATES,
} from "./dynamic-prompts";

export {
  createToolCallAnnotationStore,
  createStatusAnnotation,
  createProgressAnnotation,
  createResultAnnotation,
  createErrorAnnotation,
} from "./tool-annotations";

export { createMetadataStore, METADATA_KEYS } from "./message-metadata";

export {
  isClean,
  findCleanPrefix,
  getCommittablePrefix,
  isInsideCodeFence,
  wrapTablesForAppend,
} from "./streaming-markdown";
