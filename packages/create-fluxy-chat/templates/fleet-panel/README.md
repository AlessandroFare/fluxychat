# FluxyChat fleet panel

HTTP GPS ingest (`POST /fleet/gps`) fans out `fleet.gps_update` (geofence enter/exit on transition). Not MQTT, not Traccar protocols.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-fleet --example fleet-panel
cp .env.example .env
npm run dev
```
