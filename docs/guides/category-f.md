# Category F — Developer Experience (10 modules)

## F-1: Testing Utilities (`testing-utils.ts`)

Mock adapters, mock state, mock chat instances, Vitest custom matchers.

```
createMockAdapter(name?, overrides?) → MockAdapter
createMockState() → MockStateAdapter
createMockChatInstance() → MockChatInstance
createTestMessage(id, text, overrides?) → Message
mockLogger / createMockLogger() → Logger
matchers → { toHavePosted, toHaveEdited, toHaveDeleted, toHaveReactedWith, ... }
registerMatchers(expect) → void
```

**Usage:**
```typescript
const adapter = createMockAdapter("slack");
adapter.postMessage("thread:1", "hello");
expect(matchers.toHavePosted(adapter, "thread:1").pass).toBe(true);
```

**Matchers:** `toHavePosted`, `toHaveEdited`, `toHaveDeleted`, `toHaveReactedWith`, `toHaveStartedTyping`, `toHavePostedToChannel`, `toHaveDispatched`, `toBeSubscribedTo` (async).

---

## F-2: Error Hierarchy (`structured-errors.ts`)

Typed error classes for chat operations.

```
ChatError(code, message)                     — base error with machine-readable `code`
RateLimitError(retryAfterMs, message?)       — 429 rate limit with retry timing
LockError(message?)                          — distributed lock acquisition failure
NotImplementedError(feature)                 — unsupported adapter feature
```

**Codes:** `RATE_LIMITED`, `LOCK_ACQUISITION_FAILED`, `NOT_IMPLEMENTED`.

---

## F-3: Telemetry/OpenTelemetry (`telemetry.ts`)

OpenTelemetry-compatible telemetry system with lifecycle hooks and provider integrations.

```
createTelemetryManager(options?) → TelemetryManager
registerTelemetry(manager, integration) → void
OpenTelemetryIntegration(tracer?) → TelemetryIntegration
DevToolsTelemetryIntegration() → TelemetryIntegration
```

**Key APIs:** `register`, `unregister`, `createSpan`, `endSpan`, `record` (lifecycle events).
**Lifecycle:** `onStart`, `onEnd`, `onStepStart`, `onStepEnd`, `onLanguageModelCallStart`, `onLanguageModelCallEnd`, `onToolExecutionStart`, `onToolExecutionEnd`, `onAbort`.
**Options:** `isEnabled`, `recordInputs`, `recordOutputs`, `functionId`, `metadata`.

**Usage:**
```typescript
const manager = createTelemetryManager({ isEnabled: true });
manager.register(new OpenTelemetryIntegration());
manager.record({ phase: "onStart", event: { type: "generateText", timestamp: Date.now() } });
```

---

## F-4: DevTools Local Inspector (`devtools.ts`)

In-memory devtools store and inspector for debugging AI SDK calls.

```
createDevToolsStore() → DevToolsStore
createDevToolsInspector(store?) → DevToolsInspector
```

**Key APIs:** `getRuns`, `getRun`, `getSteps`, `addRun`, `addStep`, `updateRun`, `clear`, `captureGenerateText`, `captureStreamText`, `captureToolCall`.

**Usage:**
```typescript
const inspector = createDevToolsInspector();
inspector.getStore().addRun({ id: "run-1", startedAt: Date.now(), steps: [] });
inspector.captureGenerateText("run-1", 1, { model: "gpt-4", provider: "openai" });
inspector.captureToolCall("step_1", "weather", { location: "NYC" }, { temp: 72 }, 100);
```

---

## F-5: AI SDK Skill (`docs/guides/ai-sdk-skill.md`)

Complete agent skill documentation for Claude Code / coding agents embedding the FluxyChat SDK context.
See `docs/guides/ai-sdk-skill.md` for the full skill text.

---

## F-6: Call Options Schema (`call-options.ts`)

Type-safe call options with schema definition and `prepareCall` pattern for agent configuration at runtime.

```
callOptionsSchema(schema) → CallOptionsSchema
prepareCall(fn) → PrepareCall
createAgentWithCallOptions(schema, prepare) → AgentWithCallOptions
```

**Key APIs:** `callOptionsSchema`, `prepareCall`, `createAgentWithCallOptions`.
**Supports:** dynamic model selection, instructions, tools, maxSteps, temperature, providerOptions.

**Usage:**
```typescript
const agent = createAgentWithCallOptions(
  { userId: { type: "string", required: true, description: "User ID" } },
  ({ options }) => ({ instructions: `Hello ${options.userId}` })
);
```

---

## F-7: Dynamic Tools Runtime (`dynamic-tools.ts`)

Runtime tool registration with `dynamicTool()` factory and type narrowing.

```
dynamicTool(config) → DynamicTool
createDynamicToolRegistry() → DynamicToolRegistry
typeNarrowDynamicTool<TInput, TOutput>(config) → DynamicTool
```

**Key APIs:** `register`, `unregister`, `get`, `list`, `call`, `clear`.

**Usage:**
```typescript
const registry = createDynamicToolRegistry();
registry.register(dynamicTool({ name: "weather", execute: (input) => ({ temp: 72 }) }));
const result = await registry.call("weather", { location: "NYC" });
```

---

## F-8: Deterministic Test Models (`deterministic-models.ts`)

Scriptable deterministic language models for testing.

```
createDeterministicLanguageModel(modelId?, provider?, config?) → DeterministicLanguageModel
```

**Key APIs:** `generate(prompt, options?)`, `stream(prompt, options?)`, `configure(config)`, `getCallHistory()`, `reset()`.
**Config:** `defaultOutput`, `outputs` (per-prompt), `chunks` (stream), `shouldThrow`, `throwMessage`, `latencyMs`.

**Usage:**
```typescript
const model = createDeterministicLanguageModel("test-model", "test", {
  outputs: { "hello": { text: "Hi!", finishReason: "stop" } },
  chunks: [{ type: "text", textDelta: "Hello " }, { type: "finish", finishReason: "stop" }],
});
const result = await model.generate("hello");
const stream = model.stream("hello");
```

---

## F-9: Stream Fixtures (`stream-fixtures.ts`)

Pre-built stream fixtures for testing edge cases: malformed JSON, split UTF-8, abort, provider error, reconnect, empty, large output.

```
streamFixtures → Record<string, StreamFixture>
getStreamFixture(name) → StreamFixture | undefined
listStreamFixtures() → string[]
simulateStream(fixture) → AsyncIterable<string>
```

**Fixtures:** `malformed`, `splitUtf8`, `abort`, `providerError`, `reconnect`, `empty`, `onlyFinish`, `largeOutput`.

---

## F-10: API Report Test (`api-report.test.ts`)

Stable public API surface test that validates all expected exports from `index.ts` and alerts on missing or unexpected exports.

```
- Verifies expected export list
- Ensures no internal-only (`_`-prefixed) symbols leak
- Validates no undefined exports
- Tracks export count stability
```
