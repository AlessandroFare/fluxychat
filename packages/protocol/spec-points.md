# Fluxy protocol points

IDs for tests and the wire. Not Ably `RSC*` numbers.

| Id | Must |
| --- | --- |
| FX-RTN-1 | Client connects with integer `protocol` on the WebSocket URL. |
| FX-RTN-2 | Reconnect sends `{ type: resume, lastSeq }`. |
| FX-RTN-3 | Connection statuses include `suspended` (still retrying) and `failed` (stop). |
| FX-MSG-1 | Client-generated `clientMessageId` is idempotent on send. |
| FX-MSG-2 | `messages.with` / `copy` apply update/delete/reaction.summary; `text` aliases `content`. |
| FX-MSG-3 | `Message.version.serial` / `timestamp`; `with` skips older or same versions. |
| FX-CLI-1 | `fluxy-room occupancy` / `exists` hit REST `/rooms/:id/live`. |
| FX-CLI-2 | `fluxy-room version` prints `FLUXY_SDK_VERSION` (chat-js `VERSION`). |
| FX-LOG-2 | `logger.logLevel`; `client.version` matches the SDK package. `dispose()` is a Promise. |
| FX-ROOM-3 | `rooms.exists(name)` is true for a tracked room, else REST live snapshot. |
| FX-SEQ-1 | A seq hole buffers live frames, fills from resume, or emits `discontinuity` (10200). `room.onDiscontinuity` is ErrorInfo + `{ off }`. |
| FX-ERR-1 | Errors have a catalog code and `unable to <op>; <reason>` via `FluxyErrorInfo`. |
| FX-ERR-2 | `errorInfoIs(error, identifier\|code)` matches catalog entries. `client.clientOptions.logLevel` has no secrets. |
| FX-CUR-1 | Cursors batch `{ x, y, offsetMs }` and remotes dispense the path. |
| FX-OCC-1 | Join/leave broadcasts `occupancy` with `connections` and unique `presenceMembers`. `subscribe` delivers `{ occupancy }`. |
| FX-CONN-1 | `client.connection.status` / `error` / `onStatusChange` aggregate room sockets (Ably ChatClient.connection names). |
| FX-LOCK-1 | Exclusive `lock_acquire` / `lock_release` on the Room DO; inbound `lock` frames; `locks.getAll()`. |
| FX-LOCK-2 | Lock `attributes` on acquire; local `pending` → `locked`/`unlocked`; duplicate pending throws. |
| FX-LOCK-3 | `locks.getAll` / `getSelf` / `getOthers` are currently `locked` rows (Spaces). `get(id)` still includes pending. |
| FX-PRES-4 | `presence.subscribe` delivers `{ type: enter\|leave\|update\|present, member }`. |
| FX-CONN-2 | `client.connection.ping()` / room `ping()` is RTT on `{ type: ping }` / pong. |
| FX-TYP-1 | `room.typing.keystroke()` / `start()` / `stop()`; CHA-T10 `typing.heartbeatThrottleMs` (default 10s). |
| FX-PRES-3 | `presence.enableEvents: false` throws `feature_not_enabled` on subscribe; `get` stays REST. |
| FX-RREAC-1 | Ephemeral `room_reaction` fan-out; `send({ name, metadata, headers })`; not persisted. |
| FX-LOC-1 | `locations.set` / `getSelf` / `getOthers` / `getAll` last uiLocation per user on this socket. |
| FX-PRES-1 | `room.presence.enter` / `update` / `leave(data?)` return a Promise (chat-js). Leave does not close the socket. |
| FX-HIST-1 | `room.messages.history` pages newest-first; `subscribe` is `{ type: message.created\|updated\|deleted, message }`; `historyBeforeSubscribe` fills before live. |
| FX-HIST-8 | `messages.subscribe(type\|types, listener)` filters created/updated/deleted; subscription has `off`. |
| FX-PRES-6 | `presence.get({ clientId })` filters `/live`; `onPresenceStateChange` tracks local enter/leave. |
| FX-PRES-7 | `presence.get({ waitForSync })` defaults true; waits for `connected` like Ably presence SYNC. |
| FX-TYP-2 | `typing.subscribe` is `{ type: typing.set.changed, currentlyTyping, change }`. |
| FX-HIST-2 | `room.messages.get(id)` is REST `GET /messages/:id` (numeric id, room-scoped). |
| FX-HIST-3 | `room.messages.getVersions(id)` is REST `GET /messages/:id/versions` from `room_message_events`. |
| FX-HIST-4 | `messages.send({ text, metadata, headers })`; PATCH/DELETE return the Message. |
| FX-HIST-5 | update/delete accept `OperationDetails` (`description`, operation metadata). |
| FX-ROOM-1 | `rooms.get` waits for in-flight `release`; after `dispose` throws `resource_disposed` (40041). |
| FX-ROOM-2 | `client.clientId`, `rooms.count`, `room.error`, `room.onStatusChange`. |
| FX-ROOM-4 | `room.options` is the honored typing/occupancy/presence/messages/members slice. `client.dispose()` aliases `close()`. |
| FX-PRES-5 | `presence.subscribe(type\|types, listener)` filters enter/leave/update/present. |
| FX-LOC-2 | `locations.subscribe` includes Spaces `member` / `currentLocation` / `previousLocation`. |
| FX-TYP-3 | `typing.currentTypers()` is `{ userId, clientId }[]`; `current()` stays the id set; `current.size` / `has` match the Ably getter. |
| FX-HIST-6 | History window `start`/`after` (inclusive) and `end` (exclusive), ISO or epoch ms. |
| FX-HIST-7 | `fromSerial` rewind is exclusive `id > serial` (numeric id as serial). Messages expose `serial`. |
| FX-HIST-9 | History `next()` pages with `beforeSerial` (`id < n`), not only `createdAt`. |
| FX-OCC-2 | `occupancy.enableEvents: false` throws `feature_not_enabled` on subscribe/`current` and drops live frames; `get()` stays REST `/live`. |
| FX-OCC-3 | `occupancy.current()` still returns counts; `occupancy.current.connections` matches the Ably getter. |
| FX-CONN-3 | `client.realtime` aliases `client.connection` (chat-js `ChatClient.realtime`). |
| FX-CONN-4 | `client.connection.whenState(status)` resolves immediately if already there (ably-js). |
| FX-REAC-1 | `reactions.subscribe` unique+distinct maps (Slack-style one-of-each); `subscribeRaw` per-user frames; REST summary. |
| FX-REAC-3 | `summary.multiple` counts per client; unique stays one-of-each. |
| FX-REAC-4 | `reactions.send/delete` take `{ name, type, count }`; unique replaces all; distinct insert-if-missing; multiple inserts `count`; delete unique can omit name. |
| FX-REAC-5 | WS `reaction` frames use the same `planReactionMutation` as REST. |
| FX-REAC-2 | `messages.rawMessageReactions` default off (CHA); `subscribeRaw` throws `feature_not_enabled` unless opted in. |
| FX-RREAC-2 | `room.reactions.subscribe` is `{ type: reaction, reaction }`. |
| FX-LOG-1 | `client.logger` with `trace`/`withContext` and `logLevel`. |
| FX-CUR-3 | `room.cursors.getAll` is last live position per user; `history({ start, end, limit })` pages in-session points (not REST channel.history). |
| FX-CUR-6 | Room DO keeps last cursor per user and replays it on connect (`snapshot`), Spaces `getLastCursorUpdate`. |
| FX-OBJ-1 | `room.objects` is the room `derived` JSON bag (`derived_set` / inbound `derived`). |
| FX-CUR-2 | `room.cursors.set/get/subscribe` keeps last live positions for this socket. |
| FX-CUR-5 | `cursors.subscribe('update', listener)` is the Spaces event name; other names throw. |
| FX-PRES-2 | `presence.getSelf` / `getOthers` split `GET /rooms/:id/live` by `userId`. |
| FX-MEM-1 | `room.members` enter/leave/update/updateProfile/remove; getAll includes leavers until `members.offlineTimeoutMs`. |
| FX-AI-1 | Stream resume is missed characters from `fromOffset`, not a full dump. |

Cite the id in the test name when you add coverage.
