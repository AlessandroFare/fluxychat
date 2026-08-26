# FluxyChat IoT panel

HTTP ingest + room `server_event` (`iot.reading`). **Not MQTT.** Keep this tab open; curl from another terminal.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-iot --example iot-panel
```

```bash
curl -X POST "$WORKER/rooms/$ROOM/iot/events" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"sim-1","eventType":"telemetry","payload":{"temp":21}}'
```

Registered devices: `POST /iot/devices` then `POST /iot/devices/:id/readings` (device shadow). Same room WebSocket.
