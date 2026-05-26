# Message templates

Project-scoped templates with `{{variable}}` substitution for system/bot messages.

## Admin API (JWT with `admin` or `owner` role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List templates |
| POST | `/templates` | Create `{ name, body }` |
| GET | `/templates/:id` | Retrieve |
| PATCH | `/templates/:id` | Update |
| DELETE | `/templates/:id` | Delete |
| POST | `/templates/render` | Preview `{ templateId, vars }` or `{ body, vars }` |

## Send via REST

```bash
curl -X POST "$WORKER_URL/messages" \
  -H "Authorization: Bearer $MEMBER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "support-1",
    "templateId": "tpl_...",
    "templateVars": { "name": "Jane", "ticketId": "42" }
  }'
```

`content` is optional when `templateId` is set (rendered server-side).

## SDK

```ts
import { renderMessageTemplate } from "@fluxy-chat/sdk";

const preview = renderMessageTemplate("Hi {{name}}", { name: "Jane" });

await client.createMessage(roomId, "", null, undefined, clientMessageId, {
  templateId: "tpl_...",
  templateVars: { name: "Jane", ticketId: "42" },
});
```

## Member preferences

```bash
curl -X PATCH "$WORKER_URL/rooms/$ROOM_ID/members/me/preferences" \
  -H "Authorization: Bearer $MEMBER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"notifyEnabled": true, "preferences": {"locale": "en-GB"}}'
```

`GET /rooms/:id/members` returns `notifyEnabled` and `preferences` per member.
