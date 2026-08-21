import { describe, it, expect } from "vitest";
import * as publicApi from "./index";

/** Factory exports that throw at runtime — belong on `@fluxy-chat/sdk/worker-runtime` only. */
const WORKER_RUNTIME_ONLY_EXPORTS = [
  "buildToolsWithOverrides",
  "getEffectiveApproval",
  "isToolEnabled",
  "validateOverride",
  "createToolContextManager",
  "createScopedToolContext",
  "createStreamResumptionStore",
  "createApprovalStore",
  "createApprovalGate",
  "createLoopController",
  "createSandboxManager",
  "executeInSandbox",
  "createPlatformAdapter",
  "createBotDeploymentManager",
  "createProviderToolRegistry",
  "providerToolsToSchema",
  "useObject",
  "structuredOutputPrompt",
  "parseStructuredOutput",
  "validateAgainstSchema",
  "withStructuredOutput",
  "createImageGenerator",
  "createTextToSpeech",
  "createPromptRenderer",
  "createPromptTemplateRegistry",
  "createToolCallAnnotationStore",
  "createStatusAnnotation",
  "createProgressAnnotation",
  "createResultAnnotation",
  "createErrorAnnotation",
  "createMetadataStore",
  "isClean",
  "findCleanPrefix",
  "getCommittablePrefix",
  "isInsideCodeFence",
  "wrapTablesForAppend",
] as const;

describe("API Report", () => {
  const allExports = Object.keys(publicApi).filter((k) => !k.startsWith("_")).sort();

  it("should not export internal-only symbols (prefixed with underscore)", () => {
    const internals = Object.keys(publicApi).filter((name) => name.startsWith("_"));
    expect(internals).toEqual([]);
  });

  it("should not re-export worker-runtime stub factories from the client entry", () => {
    const leaked = WORKER_RUNTIME_ONLY_EXPORTS.filter((name) => name in publicApi);
    expect(leaked).toEqual([]);
  });

  it("each exported value should be a function or object (not undefined)", () => {
    for (const [key, value] of Object.entries(publicApi)) {
      expect([key, value]).not.toBeUndefined();
    }
  });

  it("export count should be reasonable (no accidental regressions)", () => {
    expect(allExports.length).toBeGreaterThanOrEqual(100);
  });

  it("should export core expected symbols", () => {
    const core = [
      "FluxyAuthError",
      "FluxyConnectionError",
      "ChatError",
      "RateLimitError",
      "LockError",
      "NotImplementedError",
      "createLogger",
      "createThreadState",
      "createDeterministicLanguageModel",
      "createTelemetryManager",
      "createDevToolsStore",
      "createDevToolsInspector",
      "callOptionsSchema",
      "dynamicTool",
      "createDynamicToolRegistry",
      "streamFixtures",
      "createMockAdapter",
      "createSpyAdapter",
      "LOOP_PRESETS",
      "METADATA_KEYS",
      "PROVIDER_TOOL_SETS",
    ];
    const missing = core.filter((name) => !allExports.includes(name));
    expect(missing).toEqual([]);
  });

  it("keeps markdown and yjs off the main barrel", () => {
    expect(allExports).not.toContain("parseMarkdown");
    expect(allExports).not.toContain("createYjsCollabPort");
    expect(allExports).not.toContain("FLUXY_MESSAGES_MAP_KEY");
  });
});
