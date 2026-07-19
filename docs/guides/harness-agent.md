# HarnessAgent — External Agent Runtime Wrapper

`HarnessAgent` wraps external agent runtimes (Claude Code, Codex, custom coding agents) behind a unified interface compatible with AI SDK stream types.

## When to Use

- You want to invoke an existing agent runtime (Claude Code, Codex) from your application
- You need streaming output from an external coding agent
- You want session management (create, detach, resume) for long-running agent interactions

## Basic Usage

```ts
import { HarnessAgent, type HarnessAdapter } from '@fluxy-chat/agent';

// Create an adapter for your external runtime
const myAdapter: HarnessAdapter = {
  name: 'my-coding-agent',
  async createSession(sandbox) {
    return {
      id: crypto.randomUUID(),
      async destroy() { /* cleanup */ },
      async detach() { return { sessionId: this.id, state: null, createdAt: Date.now() }; },
    };
  },
  async generate(options) {
    // Call your external agent
    return {
      text: 'Agent response',
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50 },
      steps: [],
      responseMessages: [],
    };
  },
  async stream(options) {
    // Return streaming result from your agent
    const result = await this.generate(options);
    return {
      stream: new ReadableStream({ ... }),
      result: Promise.resolve(result),
      text: Promise.resolve(result.text),
    };
  },
};

const agent = new HarnessAgent(myAdapter);
const result = await agent.generate({ prompt: 'Refactor the auth module' });
```

## Session Management

Create a session for stateful multi-turn interactions:

```ts
const session = await agent.createSession(/* sandbox config */);

try {
  const result = await agent.generate({
    session,
    prompt: 'List all files in the project',
  });
  console.log(result.text);

  // Resume the session for follow-up
  const followUp = await agent.generate({
    session,
    prompt: 'Now refactor the main entry point',
  });
} finally {
  await session.destroy();
}
```

## Streaming

`stream()` returns a `HarnessStreamResult` with AI SDK-compatible stream parts:

```ts
const sr = agent.stream({ prompt: 'Analyze the codebase' });

// Consume the stream
const reader = sr.stream.getReader();
for await (const part of /* async iteration */) {
  if (part.type === 'text-delta') process.stdout.write(part.delta);
}

// Or get the final result
const result = await sr.result;
console.log(result.text, result.usage);
```

## Adapter Pattern

The `HarnessAdapter` interface lets you wrap any external runtime:

```ts
interface HarnessAdapter {
  readonly name: string;
  createSession(sandbox?: unknown): Promise<HarnessSession>;
  generate(options: {
    prompt: string;
    system?: string;
    tools?: Record<string, AITool>;
    maxSteps?: number;
    signal?: AbortSignal;
    session?: HarnessSession;
  }): Promise<HarnessGenerateResult>;
  stream(options: {
    prompt: string;
    system?: string;
    tools?: Record<string, AITool>;
    maxSteps?: number;
    signal?: AbortSignal;
    session?: HarnessSession;
  }): Promise<HarnessStreamResult>;
}
```

## Type Reference

```ts
class HarnessAgent {
  readonly adapter: HarnessAdapter;
  constructor(adapter: HarnessAdapter);
  createSession(sandbox?: unknown): Promise<HarnessSession>;
  generate(options: HarnessGenerateOptions): Promise<HarnessGenerateResult>;
  stream(options: HarnessStreamOptions): HarnessStreamResult;
}

interface HarnessSession {
  readonly id: string;
  destroy(): Promise<void>;
  detach(): Promise<HarnessSessionResumeState>;
}

interface HarnessGenerateResult {
  text: string;
  reasoningText?: string;
  finishReason: AIFinishReason;
  usage: AIUsage;
  steps: readonly HarnessStepResult[];
  responseMessages: readonly HarnessMessage[];
}

interface HarnessStreamResult {
  stream: ReadableStream<AIStreamPart>;
  result: Promise<HarnessGenerateResult>;
  text: Promise<string>;
}
```

## See Also

- [Skill Uploads](./skill-uploads.md) — uploading custom skills to providers
- [Subagents](./subagents.md) — in-process agent delegation pattern
- [LLM Middleware](./llm-middleware.md) — model-level interceptors
