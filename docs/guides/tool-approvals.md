# Tool Approvals

By default, tools with an `execute` function run automatically when the model calls them. Use `toolApproval` on `runAgentLoop` to review, approve, or deny selected tool calls before they execute.

Tool approvals are useful for tools that can modify data, spend money, execute code, send messages, access private data, or perform any other sensitive action.

## Statuses

Every approval rule returns one of these statuses, either as a string or as an object with a `type` field:

| Status | Effect |
|--------|--------|
| `'not-applicable'` | Execute the tool normally without approval metadata (default) |
| `'approved'` | Record automatic approval, then execute the tool |
| `'denied'` | Record automatic denial and return a denied tool output |
| `'user-approval'` | Emit an approval request and wait for an explicit response |

For automatic approvals and denials, use the object form to include a reason:

```ts
toolApproval: {
  deleteFile: {
    type: 'denied',
    reason: 'Deleting files is disabled in this workspace',
  },
}
```

## Require Approval for a Tool

Use a per-tool map when each tool has a simple policy:

```ts
import { runAgentLoop } from '@fluxy-chat/agent';

const result = await runAgentLoop({
  model: someModel,
  tools: {
    runCommand: {
      inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
      execute: async ({ command }) => runShellCommand(command),
    },
  },
  toolApproval: {
    runCommand: 'user-approval',
  },
});
```

When `runCommand` is called, the agent returns approval requests instead of executing the tool.

## Decide Based on Tool Input

Use a per-tool approval function when the decision depends on the parsed tool input:

```ts
toolApproval: {
  processPayment: async (input, { toolCallId, messages, runtime }) => {
    const amount = (input as { amount?: number }).amount ?? 0;
    if (amount > 1000) {
      return { type: 'user-approval' };
    }
    if ((runtime as { role?: string }).role !== 'admin') {
      return { type: 'denied', reason: 'Only admins can send payments' };
    }
    return undefined; // not-applicable = execute normally
  },
},
```

## One Policy for All Tools

Pass a function directly as `toolApproval` when approval depends on the full tool call or shared state:

```ts
toolApproval: ({ toolCall, messages, runtime }) => {
  if (toolCall.name === 'deleteFile') {
    return { type: 'denied', reason: 'Manual deletion disabled' };
  }
  if ((runtime as { env?: string }).env === 'production') {
    return 'user-approval';
  }
  return undefined; // not-applicable
},
```

The generic function receives:
- `toolCall`: the full tool call (`id`, `name`, `input`)
- `messages`: messages sent to the model for the step that produced the call
- `runtime`: shared runtime context

## Manual Approval Flow

Manual approval requires two calls when using `runAgentLoop`:

1. Configure `toolApproval` + `onApprovalRequired` callback
2. The callback receives an `ApprovalRequest` — return `true` to approve or `false` to deny

```ts
const result = await runAgentLoop({
  model: someModel,
  tools: { deleteFile: { inputSchema: {}, execute: async () => 'deleted' } },
  toolApproval: { deleteFile: 'user-approval' },
  onApprovalRequired: async (request: ApprovalRequest) => {
    const approved = await askUser(`Allow ${request.toolName}?`);
    return approved;
  },
  maxSteps: 5,
});
```

If approved, the tool executes. If denied, the model receives a denial result and can respond without the tool output.

## HMAC-Signed Approvals

For sensitive tools that modify data, spend money, or access private resources, use `toolApprovalSecret` to cryptographically bind approvals to the server that issued them.

When a secret is provided, the server HMAC-signs each approval request and verifies the signature when the approval is replayed. A forged or tampered approval is rejected before the tool executes.

```ts
const result = await runAgentLoop({
  model: someModel,
  tools: {
    deleteFile: {
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      execute: async ({ path }) => deleteFile(path),
    },
  },
  toolApproval: { deleteFile: 'user-approval' },
  toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
  onApprovalRequired: async (request) => {
    // request.signature is the HMAC binding this approval to its input
    return askUser(`Delete ${request.input}?`);
  },
  maxSteps: 5,
});
```

**Setup:**

1. Generate a high-entropy random string (at least 32 bytes):
   ```bash
   openssl rand -base64 32
   ```
2. Store it as an environment variable accessible to all server instances:
   ```
   TOOL_APPROVAL_SECRET=your-generated-secret-here
   ```
3. Pass it via `toolApprovalSecret`.

**Behavior when configured:**
- Approval requests without a valid signature are rejected (fail-closed)
- No secret configured: approvals work as before (backward compatible)
- The secret is never sent to the client or included in the stream

The signature binds the approval to the exact tool name, tool call ID, and input arguments. Changing any of these after signing invalidates the approval.

## Priority Resolution

`resolveToolApproval` follows this order:

1. **Generic function** (if `toolApproval` is a function) — evaluated first
2. **Per-tool function** (if `toolApproval[toolName]` is a function) — evaluated with typed input
3. **Per-tool status** (string or object status) — direct match
4. **needsApproval legacy** (`tool.needsApproval`) — fallback for backward compatibility

User-defined settings always take precedence over tool-defined settings.

## API Reference

### ToolApprovalStatus
```ts
type ToolApprovalStatus =
  | undefined
  | 'not-applicable'
  | 'approved'
  | 'denied'
  | 'user-approval'
  | ToolApprovalDecision;
```

### ToolApprovalDecision
```ts
interface ToolApprovalDecision {
  type: 'not-applicable' | 'approved' | 'denied' | 'user-approval';
  reason?: string;
}
```

### ApprovalRequest
```ts
interface ApprovalRequest {
  type: 'tool-approval-request';
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  isAutomatic?: boolean;
  signature?: string;
}
```

### ApprovalResponse
```ts
interface ApprovalResponse {
  type: 'tool-approval-response';
  approvalId: string;
  approved: boolean;
  reason?: string;
  providerExecuted?: boolean;
}
```

### ToolApprovalRecord
```ts
interface ToolApprovalRecord {
  status: 'not-applicable' | 'approved' | 'denied' | 'user-approval';
  reason?: string;
  signed?: ApprovalRequest;
}
```

### ToolApprovalConfig
```ts
type ToolApprovalConfig =
  | Record<string, ToolApprovalStatus | SingleToolApprovalFunction>
  | GenericToolApprovalFunction;
```

### AgentLoopOptions
```ts
interface AgentLoopOptions {
  // ...
  toolApproval?: ToolApprovalConfig;
  toolApprovalSecret?: string | Uint8Array;
  onApprovalRequired?: (request: ApprovalRequest) => Promise<boolean>;
  // ...
}
```

### Stream Parts
```ts
type AIStreamPart =
  // ...
  | { type: 'approval-request'; approvalId: string; toolCallId: string; toolName: string; input: unknown; isAutomatic?: boolean; signature?: string }
  | { type: 'approval-response'; approvalId: string; toolCallId: string; toolName: string; approved: boolean; reason?: string; providerExecuted?: boolean };
```

### Legacy Support

For backward compatibility, tools can define `needsApproval`:

```ts
const tool: AITool = {
  inputSchema: {},
  needsApproval: (input) => (input as { dangerous?: boolean }).dangerous ?? false,
  execute: async (input) => { /* ... */ },
};
```

When no `toolApproval` config is provided, `needsApproval` on the tool definition is used. When both are present, `toolApproval` takes precedence.
