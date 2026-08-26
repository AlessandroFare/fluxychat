# FluxyChat fleet panel

HTTP GPS ingest (`POST /fleet/gps`) fans out `server_event` `fleet.gps_update` on the room. Not MQTT.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-fleet --example fleet-panel
cp .env.example .env
npm run dev
```
