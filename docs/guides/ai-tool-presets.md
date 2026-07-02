# AI Tool Presets & Approval Gates

FluxyChat's tool preset system (P22-D) gives operators fine-grained control over what AI agents can do — from read-only observation to full moderation — with per-tool approval gates for high-risk actions.

## Overview

Instead of all-or-nothing tool access, presets bundle tools into role-based groups. Each tool can require human approval before execution, ensuring enterprise governance over AI actions.

## Three Built-in Presets

### `reader` — Read-Only

Tools that observe and retrieve information. No side effects.

- `list_rooms`, `get_room_messages`, `search_chat`, `get_room_info`
- `get_room_memory`, `get_knowledge_graph`
- No approval required

### `messenger` — Send & Reply

Everything in `reader`, plus tools that post messages.

- `send_message`, `reply_to_message`, `add_reaction`
- `suggest_replies`, `summarize_thread`
- Approval optional (configurable per profile)

### `moderator` — Full Access

Everything in `messenger`, plus administrative tools.

- `delete_message`, `pin_message`, `ban_user`, `mute_user`
- `create_room`, `archive_room`, `update_room_config`
- `run_webhook`, `send_email`, `create_ticket`
- **Approval required** for all write/moderation tools

## Usage

```ts
import { getToolPreset, applyToolOverrides } from "@fluxy-chat/sdk";

// Get tools for a support agent profile
const readerTools = getToolPreset("reader");
const messengerTools = getToolPreset("messenger");
const moderatorTools = getToolPreset("moderator");

// Each returns an array of tool definitions ready for LLM function calling
```

## Per-Tool Approval Gates

Any tool can be flagged with `needsApproval: true`. When an AI agent calls such a tool, execution pauses until a human approves or rejects the request.

```ts
import { applyToolOverrides } from "@fluxy-chat/sdk";

const tools = applyToolOverrides(moderatorTools, {
  send_email: { needsApproval: true, description: "Send email on behalf of the team" },
  run_webhook: { needsApproval: true, title: "Trigger External Webhook" },
  ban_user: { needsApproval: true },
});
```

## Approval Workflow

1. AI agent calls a tool with `needsApproval: true`
2. Worker creates an approval request in D1
3. A card with "Approve" / "Reject" buttons is posted to the room (P22-C + P22-F3)
4. Human clicks a button → callback URL routes to approval handler
5. If approved: tool executes
6. If rejected: agent receives `tool_error` with "Action rejected by operator"
7. Full audit trail recorded in `audit_events`

## Tool Overrides

Customize tool metadata without changing implementation:

```ts
const customized = applyToolOverrides(preset, {
  send_message: {
    description: "Post a message to the current support room",
    title: "Send Message",
  },
  delete_message: {
    needsApproval: true,
    title: "Delete Message (requires approval)",
  },
});
```

## Concurrency Strategies (P22-D3)

Each adapter/room can configure how messages and tool calls are processed:

| Strategy | Behavior | Use case |
|----------|----------|----------|
| `drop` | Discard new messages while processing | High-frequency live chat |
| `queue` | FIFO ordered processing | Support tickets |
| `debounce` | Wait for quiet period, then process last | Rapid status updates |
| `burst` | Allow N concurrent, queue the rest | Bursty workloads |
| `concurrent` | Process all in parallel | Read-only operations |

## Scoped Tool Context (P23-10)

Each tool gets only the context it needs. API keys, permissions, and tenant data are isolated per-tool — a tool that searches rooms can't access billing data.

```ts
const tools = buildScopedTools({
  send_email: { apiKey: process.env.EMAIL_KEY },
  run_webhook: { allowedUrls: ["https://api.mycompany.com/*"] },
});
```

## See Also

- [Card Builder Guide](./card-builder.md) — Approval UI cards
- [LLM Middleware Guide](./llm-middleware.md) — Intercept tool calls before execution
