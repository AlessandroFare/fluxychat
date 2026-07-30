# Message-to-LLM Converter

`toAiMessages()` converts FluxyChat messages into the message format expected by AI SDKs (OpenAI, Anthropic, Vercel AI SDK, etc.).

## When to Use

- Feeding chat history to an AI agent
- Converting a conversation thread into context for `generateText` or `streamText`
- Building AI-powered chat features on top of FluxyChat

## Usage

```ts
import { toAiMessages } from "@fluxy-chat/sdk";

const messages = await client.getMessages("room-1", { limit: 50 });
const history = await toAiMessages(messages, {
  botUserId: "agent-bot-123",
});

// Use with any AI SDK
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: history,
});
```

## Options

### `botUserId`

Identifies which user is the bot/agent. Messages from this user are mapped to `role: "assistant"`, all others to `role: "user"`.

```ts
toAiMessages(messages, { botUserId: "my-bot-id" });
```

### `includeNames`

When `true`, prefixes user messages with `[userId]:` for multi-user context:

```ts
toAiMessages(messages, { includeNames: true });
// User message → "[alice]: hello there"
```

### `transformMessage`

Hook to modify or skip individual messages:

```ts
toAiMessages(messages, {
  transformMessage: (aiMessage, sourceMsg) => {
    // Add prefix to all messages
    return { ...aiMessage, content: `[${sourceMsg.roomId}] ${aiMessage.content}` };
    // Or return null to skip
  },
});
```

### `onUnsupportedAttachment`

Callback for attachment types that can't be converted (audio, video):

```ts
toAiMessages(messages, {
  onUnsupportedAttachment: (att, msg) => {
    console.warn(`Can't include ${att.kind} from message ${msg.id}`);
  },
});
```

## How It Works

1. Messages are sorted chronologically by `createdAt`
2. Empty/whitespace-only content is filtered out
3. Bot messages become `assistant`, user messages become `user`
4. Link previews are appended as text
5. Image and text files are converted to `FilePart` using their URL
6. Unsupported attachments trigger the callback

## Output Format

```ts
type AiMessage =
  | { role: "user"; content: string | AiMessagePart[] }
  | { role: "assistant"; content: string };
```

This format is compatible with the Vercel AI SDK's `ModelMessage` type and most LLM provider APIs.

## See Also

- [Provider Registry Guide](./provider-registry.md) — Managing AI providers
- [LLM Middleware Guide](./llm-middleware.md) — Transforming AI SDK calls
