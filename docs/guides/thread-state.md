# Per-Thread Typed State

`createThreadState()` provides a typed state accessor per thread with merge/replace semantics and TTL — designed for multi-turn agent context.

## Usage

```ts
import { createThreadState, createThreadStateStore } from "@fluxy-chat/sdk";

interface AgentState {
  mode: "chat" | "agent";
  count: number;
}

const store = createThreadStateStore();
const ts = createThreadState<AgentState>("thread:abc", store);

// Set state (merge by default)
await ts.setState({ mode: "agent" });
await ts.setState({ count: 1 });

// Read state
const state = await ts.state;
// { mode: "agent", count: 1 }

// Replace entire state
await ts.setState({ mode: "chat" }, { replace: true });
```

## TypedThreadState API

| Member | Type | Description |
|--------|------|-------------|
| `state` | `Promise<T \| null>` | Read current state |
| `setState(partial, options?)` | `Promise<void>` | Set state (merge/replace) |
| `threadId` | `string` | Thread identifier |

## Store

```ts
const store = createThreadStateStore();      // In-memory
const store = createThreadStateStore(kv);    // Cloudflare KV
```

## TTL

Default 30 days (`THREAD_STATE_TTL_MS`). Override per accessor:

```ts
const ts = createThreadState<AgentState>("thread:1", store, 60_000); // 1 min
```
