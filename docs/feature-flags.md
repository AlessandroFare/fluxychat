# Feature flags (P12-J)

FluxyChat evaluates [Cloudflare Flagship](https://developers.cloudflare.com/flagship/) flags via `env.FLAGS` when bound, with legacy env fallbacks for local dev.

## Flags

| Key | Gates | Env fallback |
|-----|-------|--------------|
| `voice_messages` | `POST /messages/voice` | `FEATURE_VOICE_MESSAGES` / `VOICE_MESSAGES_ENABLED` (default on) |
| `reply_suggestions` | `POST /messages/suggest-replies` | `FEATURE_REPLY_SUGGESTIONS` (default on) |
| `embed_widget` | `/embed.js`, embed guest sessions | `EMBED_WIDGET_ENABLED` (default on) |
| `reconnect_backoff_fluxy` | SDK reconnect curve (1s/8s) | `FEATURE_RECONNECT_BACKOFF_FLUXY` (default off) |

## API

`GET /client/feature-flags` — public; pass `Authorization: Bearer …` for user/project targeting.

```json
{
  "flags": {
    "voice_messages": true,
    "reply_suggestions": true,
    "embed_widget": true,
    "reconnect_backoff_fluxy": false
  },
  "flagship": true,
  "reconnectBackoff": { "baseBackoffMs": 500, "maxBackoffMs": 20000 }
}
```

SDK: `client.getFeatureFlags()` — applied automatically on room session connect for backoff.

## Wrangler

```toml
[[flagship]]
binding = "FLAGS"
app_id = "<FLAGSHIP_APP_ID>"
```

See `apps/worker/.dev.vars.example` for env-only fallbacks.

