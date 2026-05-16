# Fluxychat AI Agent Service

External service that processes mention webhooks from Fluxychat, calls LLM providers (OpenAI, Anthropic, etc.), and posts AI-generated replies back to rooms.

## Overview

This service implements the AI agent contract defined in the Fluxychat specification:

1. **Receives webhooks**: Listens for `"mention"` events from Fluxychat
2. **Resolves agents**: Looks up agent configuration for mentioned handles (e.g., `@chatgpt`)
3. **Fetches context**: Retrieves recent messages from the room via Fluxychat API
4. **Calls LLM**: Invokes the configured provider (OpenAI, Anthropic, etc.)
5. **Posts replies**: Sends AI-generated content back via `/rooms/{id}/messages/from-bot`

## Architecture

- **Cloudflare Worker**: Edge-deployed, serverless, scales automatically
- **Stateless**: No database required; agent configs via KV or environment variables
- **Async processing**: Webhook handler returns immediately, processes in background

## Setup

### 1. Install Dependencies

```bash
cd apps/ai-agent
pnpm install
```

### 2. Configure Environment Variables

Create a `.dev.vars` file (for local development) or set secrets in Cloudflare:

```bash
# Fluxychat API base URL
FLUXY_BASE_URL=https://api.fluxychat.com

# Webhook secret (must match the secret used when registering webhook in Fluxychat)
WEBHOOK_SECRET=your-webhook-secret

# JWT secret for service-to-service auth (must match project's JWT secret in Fluxychat)
JWT_SECRET=your-project-jwt-secret

# OpenAI API key (global default)
OPENAI_API_KEY=sk-...

# Agent-specific configs (optional, can use KV instead)
AGENT_proj123_chatgpt_BOT_ID=bot_chatgpt
AGENT_proj123_chatgpt_PROVIDER=openai
AGENT_proj123_chatgpt_MODEL=gpt-4o-mini
AGENT_proj123_chatgpt_MODE=chat
AGENT_proj123_chatgpt_CAPABILITIES=chat
AGENT_proj123_chatgpt_SYSTEM_PROMPT=You are a helpful assistant.
AGENT_proj123_chatgpt_API_KEY=sk-... # Optional override
```

### 3. Register Webhook in Fluxychat

In your Fluxychat project, register a webhook pointing to this service:

```bash
curl -X POST https://api.fluxychat.com/webhooks/register \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ai-agent.your-domain.workers.dev/webhooks/mention",
    "eventTypes": ["mention"],
    "secret": "your-webhook-secret"
  }'
```

### 4. Register Bot in Fluxychat

Create a bot that the AI agent will use to post messages:

```bash
curl -X POST https://api.fluxychat.com/bots \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bot_chatgpt",
    "name": "ChatGPT",
    "handle": "chatgpt",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "capabilities": ["chat"]
  }'
```

### 5. Run Locally

```bash
pnpm dev
```

The service will be available at `http://localhost:8788` (or the port Wrangler assigns).

## Agent Configuration

Agent configs can be stored in three ways (checked in order):

1. **KV Namespace** (recommended for production):
   - Key: `<projectId>:<handle>`
   - Value: JSON object matching `AgentConfig` interface

2. **Environment Variables**:
   - Pattern: `AGENT_<projectId>_<handle>_<field>`
   - Example: `AGENT_proj123_chatgpt_BOT_ID=bot_chatgpt`

3. **Default Config** (development only):
   - If handle is `"chatgpt"` and `OPENAI_API_KEY` is set, uses default OpenAI config

## Supported Providers

### OpenAI

- **Provider**: `"openai"` or `"azure-openai"`
- **Models**: Any OpenAI model (e.g., `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`)
- **API Key**: Set via `OPENAI_API_KEY` env var or per-agent `apiKey`

### Anthropic (Planned)

- **Provider**: `"anthropic"`
- **Models**: Claude models (e.g., `claude-3-5-sonnet`)
- **Status**: Placeholder implementation

## Mode Selection

The service supports three modes (determined by message content or agent default):

- **`chat`**: Public reply posted to the room
- **`suggest`**: Private suggestion (future: visible only to mentioned user)
- **`image`**: Image generation (future: posts image attachment)

Mode is selected by:
1. Command prefix: `/image ...` → `image`, `/suggest ...` → `suggest`
2. Agent default: Falls back to `agent.defaultMode`

## API Endpoints

### `POST /webhooks/mention`

Receives mention webhooks from Fluxychat.

**Headers:**
- `X-Fluxy-Event`: `"mention"`
- `X-Fluxy-Project-Id`: Project ID
- `X-Fluxy-Signature`: `sha256=<hex>` (if webhook secret is configured)

**Body:**
```json
{
  "type": "mention",
  "projectId": "proj_123",
  "payload": {
    "roomId": "room_abc",
    "fromUserId": "user_42",
    "toUserIds": ["chatgpt"],
    "messageId": 456,
    "createdAt": "2026-01-23T12:34:56Z"
  },
  "createdAt": "2026-01-23T12:34:56Z"
}
```

**Response:** `204 No Content` (processed asynchronously)

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "service": "ai-agent",
  "ts": 1737638400000
}
```

## Security

- **Webhook Signing**: Verifies HMAC-SHA256 signatures if `WEBHOOK_SECRET` is configured
- **JWT Auth**: Uses project-specific JWT secrets to authenticate with Fluxychat
- **API Keys**: Provider API keys stored in environment variables (never in code)

## Error Handling

- Webhook processing is **non-blocking**: errors are logged but don't fail the webhook
- Failed LLM calls are logged and skipped (no reply posted)
- Idempotency: Each mention is processed independently (no deduplication yet)

## Future Enhancements

- [x] Anthropic provider (`handlers.js` `callAnthropic`, env `ANTHROPIC_*`)
- [ ] Image generation mode
- [ ] Private suggestions (visible only to mentioned user)
- [ ] Rate limiting per project/agent
- [ ] Cost tracking and quotas
- [ ] PII redaction before sending to LLM
- [ ] Tool/function calling support
- [ ] Streaming responses
- [ ] Multi-turn conversation memory

## Development

### Local Testing

1. Start Fluxychat worker locally: `cd apps/worker && pnpm dev`
2. Start AI agent service: `cd apps/ai-agent && pnpm dev`
3. Use ngrok or similar to expose the AI agent service to the internet
4. Register webhook in Fluxychat pointing to your ngrok URL

### Testing Webhook Locally

```bash
curl -X POST http://localhost:8788/webhooks/mention \
  -H "Content-Type: application/json" \
  -H "X-Fluxy-Event: mention" \
  -H "X-Fluxy-Project-Id: proj_123" \
  -d '{
    "type": "mention",
    "projectId": "proj_123",
    "payload": {
      "roomId": "room_abc",
      "fromUserId": "user_42",
      "toUserIds": ["chatgpt"],
      "messageId": 456,
      "createdAt": "2026-01-23T12:34:56Z"
    },
    "createdAt": "2026-01-23T12:34:56Z"
  }'
```

## Deployment

Deploy to Cloudflare Workers:

```bash
pnpm deploy
```

Or use Wrangler directly:

```bash
wrangler deploy
```

Make sure to set all required secrets in Cloudflare:

```bash
wrangler secret put FLUXY_BASE_URL
wrangler secret put WEBHOOK_SECRET
wrangler secret put JWT_SECRET
wrangler secret put OPENAI_API_KEY
```
