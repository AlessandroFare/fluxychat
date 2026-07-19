# Replay Test Fixtures

Replay tests verify the Chat SDK handles real webhook payloads correctly by recording production interactions and replaying them in tests.

## Quick Start: SHA-Based Recording Workflow

The recommended workflow ties recordings to git commits, making it easy to capture and convert production interactions into tests.

### 1. Deploy with recording enabled

```bash
# Set in Vercel environment variables (or .env.local for local dev)
RECORDING_ENABLED=true
REDIS_URL=redis://...
```

When deployed, recordings are automatically tagged with `VERCEL_GIT_COMMIT_SHA`:

```
session-{SHA}-{timestamp}-{random}
```

### 2. Interact with your bot

Perform the interactions you want to test:

- @mention the bot in Slack, Teams, or Google Chat
- Click buttons in cards (actions)
- Add emoji reactions
- Send follow-up messages
- Request DMs ("DM me")

### 3. Find recordings for your SHA

```bash
cd examples/nextjs-chat

# List all recording sessions
pnpm recording:list

# Find sessions for current commit
pnpm recording:list | grep $(git rev-parse HEAD | cut -c1-7)

# Output shows sessions with entry counts:
#   session-abc123... (5 entries)
```

### 4. Export recordings

```bash
# Export a specific session (note: filter out pnpm output)
pnpm recording:export session-abc123 2>&1 | \
  grep -v "^>" | grep -v "^\[dotenv" | grep -v "^$" > /tmp/recording.json

# Verify the export
cat /tmp/recording.json | jq 'length'
```

### 5. Analyze the recording

```bash
# Group webhooks by platform
cat /tmp/recording.json | jq '[.[] | select(.type == "webhook")] | group_by(.platform) | .[] | {platform: .[0].platform, count: length}'

# View Slack webhook details
cat /tmp/recording.json | jq '[.[] | select(.type == "webhook" and .platform == "slack") | .body | fromjson | .event | {type, text: .text[0:50], channel_type}]'

# View Google Chat webhook details
cat /tmp/recording.json | jq '[.[] | select(.type == "webhook" and .platform == "gchat") | .body | fromjson | if .chat then {type: "direct", text: .chat.messagePayload.message.text[0:50]} else {type: "pubsub"} end]'
```

### 6. Extract webhook payloads into fixtures

```bash
# Extract Slack webhooks
cat /tmp/recording.json | jq '[.[] | select(.type == "webhook" and .platform == "slack") | .body | fromjson]'

# Extract Google Chat webhooks
cat /tmp/recording.json | jq '[.[] | select(.type == "webhook" and .platform == "gchat") | .body | fromjson]'

# Extract Teams webhooks
cat /tmp/recording.json | jq '[.[] | select(.type == "webhook" and .platform == "teams") | .body | fromjson]'
```

### 7. Create fixture file

Create a JSON file in the appropriate fixtures directory:

```json
{
  "botName": "My Bot",
  "botUserId": "U123...",
  "mention": {
    /* first webhook - the @mention */
  },
  "followUp": {
    /* follow-up message webhook */
  }
}
```

### 8. Write the replay test

See existing tests for examples:

- `replay.test.ts` - Basic mention and follow-up messaging
- `replay-actions-reactions.test.ts` - Button clicks and emoji reactions
- `replay-dm.test.ts` - Direct message flows

## Fixture Directory Structure

```
fixtures/replay/
├── README.md
├── slack.json           # Basic Slack messaging
├── gchat.json           # Basic Google Chat messaging
├── teams.json           # Basic Teams messaging
├── actions-reactions/   # Button clicks and reactions
│   ├── slack.json
│   ├── gchat.json
│   └── teams.json
└── dm/                  # Direct message flows
    ├── slack.json
    ├── gchat.json
    └── teams.json
```

## Fixture Formats

### Basic messaging (`slack.json`, `gchat.json`, `teams.json`)

```json
{
  "botName": "My Bot",
  "botUserId": "U123...",
  "mention": {
    /* webhook body for @mention */
  },
  "followUp": {
    /* webhook body for follow-up message */
  }
}
```

### Actions & reactions (`actions-reactions/*.json`)

```json
{
  "botName": "My Bot",
  "botUserId": "U123...",
  "mention": {
    /* webhook to subscribe the thread */
  },
  "action": {
    /* button click webhook */
  },
  "reaction": {
    /* emoji reaction webhook */
  }
}
```

### DM flows (`dm/*.json`)

```json
{
  "botName": "My Bot",
  "botUserId": "U123...",
  "dmChannelId": "D123...", // Slack only
  "dmSpaceName": "spaces/...", // GChat only
  "mention": {
    /* initial @mention in channel */
  },
  "dmRequest": {
    /* user says "DM me" in thread */
  },
  "dmMessage": {
    /* user's message in DM */
  }
}
```

## Platform-Specific Webhook Formats

### Google Chat

| Event     | Format                                                              |
| --------- | ------------------------------------------------------------------- |
| Mention   | Direct webhook with `chat.messagePayload`                           |
| Follow-up | Pub/Sub with `message.data` (base64)                                |
| Reaction  | Pub/Sub with `ce-type: "google.workspace.chat.reaction.v1.created"` |
| Action    | `type: "CARD_CLICKED"` event                                        |
| DM Space  | `chat.messagePayload.space.type: "DM"`                              |

### Slack

| Event     | Format                                                        |
| --------- | ------------------------------------------------------------- |
| Mention   | `event_callback` with `event.type: "app_mention"`             |
| Follow-up | `event_callback` with `event.type: "message"` and `thread_ts` |
| Reaction  | `event_callback` with `event.type: "reaction_added"`          |
| Action    | `block_actions` (URL-encoded form: `payload=...`)             |
| DM        | `event_callback` with `event.channel_type: "im"`              |

Raw emoji format: Slack shortcode without colons (e.g., `+1`, `heart`)

### Teams

| Event     | Format                                                |
| --------- | ----------------------------------------------------- |
| Mention   | `type: "message"` with bot in `entities` array        |
| Follow-up | `type: "message"` with same `conversation.id`         |
| Reaction  | `type: "messageReaction"` with `reactionsAdded` array |
| Action    | `type: "message"` with `value.actionId`               |
| DM        | `conversation.conversationType: "personal"`           |

Raw emoji format: Teams reaction type (e.g., `like`, `heart`)

## Recording Implementation Details

The recorder (`examples/nextjs-chat/src/lib/recorder.ts`) stores entries in Redis:

- Key: `recording:{sessionId}`
- TTL: 24 hours
- Entry types: `webhook` (incoming) and `api-call` (outgoing)

Session ID format when `VERCEL_GIT_COMMIT_SHA` is set:

```
session-{SHA}-{ISO timestamp}-{random 6 chars}
```

This makes it easy to find all recordings from a specific deployment.

## Troubleshooting

### Recording export shows log output instead of JSON

The pnpm command outputs logging to stdout. Filter it out:

```bash
pnpm recording:export <session-id> 2>&1 | grep -v "^>" | grep -v "^\[dotenv" | grep -v "^$"
```

### DM tests failing with subscription issues

DM threads need explicit subscription. When using `openDM()`, remember to call `subscribe()`:

```typescript
const dmThread = await chat.openDM(message.author);
await dmThread.subscribe();
await dmThread.post("Hello!");
```

### Google Chat Pub/Sub messages have base64 data

Decode the `message.data` field:

```bash
echo '<base64-data>' | base64 -d | jq .
```

### Teams DM not working

Teams DM functionality requires additional Azure Bot configuration. See SETUP.md for details.
