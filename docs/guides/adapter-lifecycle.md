# Adapter Lifecycle & Operations

FluxyChat's adapter lifecycle methods (P26-D) provide hooks for cleanup, ephemeral messaging, attachment rehydration, and portable background task tracking.

## Overview

Adapters in FluxyChat support optional lifecycle and operational methods beyond the core `postMessage`/`editMessage`/`deleteMessage` interface. These methods handle graceful shutdown, platform-specific ephemeral messaging, attachment handling after deserialization, and webhook background tasks.

**Source:** `apps/worker/src/lib/adapter.js`

## `disconnect()`

Optional cleanup hook for closing connections and releasing resources on shutdown.

```js
class SlackAdapter extends BaseAdapter {
  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log(`[${this.slug}] Disconnected`);
  }
}
```

### Bulk shutdown

Use `chat.shutdown()` to disconnect all registered adapters:

```js
import { chat } from "@fluxy-chat/sdk";

const result = await chat.shutdown();
// { disconnected: ["web", "slack", "discord"], errors: [] }
```

This is useful for graceful Worker lifecycle management and testing cleanup.

## `postEphemeral(threadId, message, userId, options)`

Posts an ephemeral message visible only to a specific user. Falls back to DM when the platform doesn't support ephemeral messages natively.

```js
// Slack supports ephemeral natively
await slackAdapter.postEphemeral(threadId, "Only you can see this", "U123");
// Returns: { id: "msg-123", usedFallback: false }

// Discord doesn't support ephemeral in the same way — falls back to DM
await discordAdapter.postEphemeral(threadId, "Private note", "123456789");
// Returns: { id: "dm-msg-456", usedFallback: true }
```

### The `fallbackToDM` option

The `fallbackToDM` behavior is automatic. When a platform doesn't support ephemeral messages, the adapter opens a DM and posts there instead. The `usedFallback` flag in the result lets the caller know which path was taken:

```js
const result = await adapter.postEphemeral(threadId, message, userId);
if (result.usedFallback) {
  console.log("Sent as DM instead of ephemeral");
}
```

### Overriding in a custom adapter

```js
class MyAdapter extends BaseAdapter {
  async _postEphemeralImpl(threadId, message, userId) {
    // Platform-specific ephemeral implementation
    const res = await fetch(this.apiUrl + "/ephemeral", {
      method: "POST",
      body: JSON.stringify({ threadId, message, userId }),
    });
    const data = await res.json();
    return { id: data.messageId };
  }
}
```

## `postChannelMessage(channelId, message)`

Posts a top-level message to a channel (not in a thread). This is distinct from `postMessage()` which posts into a specific thread.

```js
// Post to a Slack channel (not as a thread reply)
await slackAdapter.postChannelMessage("C123ABC", "Channel-wide announcement!");
```

## `rehydrateAttachment(attachment)`

Reconstructs `fetchData` closures after deserialization. Essential for queue/debounce strategies where attachments are serialized and processed later.

```js
// When a message with attachments is queued (debounce strategy),
// the attachment's fetchData closure is lost during JSON serialization.
// rehydrateAttachment() restores it.

class MyAdapter extends BaseAdapter {
  async rehydrateAttachment(attachment) {
    return {
      ...attachment,
      fetchData: async () => {
        // Re-fetch the file from the platform
        const res = await fetch(`${this.apiUrl}/files/${attachment.id}`);
        return res.blob();
      },
    };
  }
}
```

## `waitUntil` pattern for webhooks

Portable background task tracking for webhook handlers. On Cloudflare Workers, this maps to `ctx.waitUntil()`. On other runtimes, it can be a no-op or custom implementation.

```js
class MyAdapter extends BaseAdapter {
  async handleWebhook(req, { waitUntil }) {
    const parsed = this.parseMessage(await req.json());

    // Fire-and-forget background task
    waitUntil(this.syncUser(parsed.userId));

    // Return immediately
    return parsed;
  }
}
```

The `waitUntil` option is passed through the webhook handler options and allows adapters to schedule background work (analytics, logging, cache invalidation) without blocking the response.

## `fetchChannelMessages(channelId, options)`

Fetches top-level channel messages (not thread replies). Enables moderation and analytics workflows.

```js
const messages = await slackAdapter.fetchChannelMessages("C123ABC", {
  limit: 50,
  cursor: "next-cursor-token",
});
// [{ id, content, userId, createdAt, threadId? }, ...]
```

## `listThreads(channelId, options)`

Lists threads within a channel. Returns lightweight thread summaries for efficiency.

```js
const threads = await slackAdapter.listThreads("C123ABC", {
  limit: 20,
});
// [{ threadId, messageCount, lastReplyAt, authorId }, ...]
```

## `getParticipants(threadId)`

Scans messages in a thread and returns deduplicated non-bot authors.

```js
const participants = await adapter.getParticipants("slack:C123:1234567890.123456");
// [{ userId: "U123", adapter: "slack" }, { userId: "U456", adapter: "slack" }]
```

## `mentionUser(userId)`

Formats a platform-specific mention string.

```js
slackAdapter.mentionUser("U123ABC");    // "<@U123ABC>"
discordAdapter.mentionUser("123456789"); // "<@123456789>"
webAdapter.mentionUser("alice");         // "@alice"
```

## See Also

- [Unified Chat API](./unified-chat-api.md) — `chat.thread()`, `chat.openDM()`, `chat.shutdown()`
- [Adapter Errors](./adapter-errors.md) — Error handling for adapter operations
- [Adapter Pattern](./adapter-pattern.md) — Core adapter interface
