# Cloudflare AI Gateway (P12-I)

FluxyChat routes shared Worker AI calls through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) when gateway env vars are set. Legacy direct `AI_BASE_URL` remains the fallback.

## What uses the gateway

| Feature | Module |
|---------|--------|
| Chat completions (digest, suggestions, thread summary, translation, auto-summary) | `ai-chat-completion.js` |
| Voice transcription (Whisper) | `voice-messages.js` |
| Agent LLM (openai worker fallback) | `llm-providers.js` → `agent-llm.js` / `llm-stream.js` |

Project-scoped LLM credentials (per-tenant API keys) bypass the gateway and call the provider directly.

## Configuration

Set **either** a full gateway URL **or** account + gateway id:

```bash
# Option A — explicit URL (provider segment included)
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/openai

# Option B — account + id (provider defaults to openai)
AI_GATEWAY_ACCOUNT_ID=<account_id>
AI_GATEWAY_ID=fluxychat
AI_GATEWAY_PROVIDER=openai   # optional; path segment for openai-compatible upstream
```

Auth:

```bash
AI_GATEWAY_TOKEN=...              # Cloudflare API token (or CLOUDFLARE_API_TOKEN)
AI_GATEWAY_PROVIDER_KEY=sk-...    # upstream provider key → cf-aig-authorization
# Falls back to AI_API_KEY when provider key is unset
```

Optional:

```bash
AI_GATEWAY_CACHE_TTL=3600         # response cache TTL (seconds)
AI_GATEWAY_ENABLED=false          # kill switch — force legacy AI_BASE_URL
```

Legacy fallback (when gateway is not configured):

```bash
AI_BASE_URL=https://api.openai.com
AI_API_KEY=sk-...
```

## Behavior

- `isAiConfigured(env)` is true when gateway **or** `AI_BASE_URL` is set.
- Gateway mode sends `Authorization` (Cloudflare token) and, when both tokens exist, `cf-aig-authorization` (upstream key).
- Request metadata (`cf-aig-metadata`) includes `projectId` and `feature` for cost attribution.
- Agents using the shared Worker OpenAI key receive `chatCompletionsUrl` + `gatewayHeaders` from `getAiGatewayConnectionOverrides`.

## Local dev

Copy `apps/worker/.dev.vars.example` → `.dev.vars` and set gateway vars **or** `AI_BASE_URL` + `AI_API_KEY`.

## Roadmap

See `ROADMAP_EXECUTION.md` § P12-I.
