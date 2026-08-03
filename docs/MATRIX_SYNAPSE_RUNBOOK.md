# Matrix Synapse appservice — production runbook

FluxyChat stores bridge config in D1 and receives Synapse transactions at:

```http
POST https://<worker>/webhooks/matrix/<bridgeId>
Authorization: Bearer <appservice_token>
Content-Type: application/json
```

## 1. Create bridge in dashboard

1. Open `/bridges/matrix` with admin JWT.
2. Create bridge → copy **appservice token** (shown once).
3. Copy webhook URL: `{WORKER_URL}/webhooks/matrix/{bridgeId}`.
4. Add room mappings (FluxyChat room ↔ Matrix room ID).

## 2. Synapse appservice registration

On your Synapse VPS, register an appservice (example):

```yaml
# homeserver.yaml snippet
app_service_config_files:
  - /etc/matrix/fluxychat-appservice.yaml
```

`fluxychat-appservice.yaml`:

```yaml
id: fluxychat
url: https://YOUR_WORKER/webhooks/matrix/mb_XXXXX
as_token: as_XXXXX   # same as FluxyChat appservice token
hs_token: GENERATE_RANDOM_HS_TOKEN
sender_localpart: fluxybot
namespaces:
  users:
    - exclusive: false
      regex: "@fluxybot.*"
  rooms: []
  aliases: []
```

Restart Synapse, verify `GET /_matrix/client/versions` from dashboard **Health**.

## 3. Bot access token

Set Matrix bot `access_token` on the bridge (for outbound `syncMatrixOutbound`). Create bot user via Synapse admin or login API.

## 4. Smoke test

1. Connect bridge in dashboard.
2. Post in mapped Matrix room → message appears in FluxyChat room.
3. Post in FluxyChat → appears in Matrix (requires bot token + mapping).

## 5. Security

- Rotate appservice token via **Rotate appservice token** if leaked.
- Webhook rejects unsigned requests (401/503).
- Pair with `#20` audit chain for gov/DMA exports.
