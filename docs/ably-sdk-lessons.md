# Follow Ably's client bar

Clones: `docs/research/ably/` (gitignored). Checkbox detail: `docs/research/ably/GAP-TRACKER.md`.

Labs / verticals clones (same method, separate campaign): `docs/labs-verticals-lessons.md` + `docs/research/GAP-TRACKER.md`.

We do not paste their source into this repo. We copy **behaviour**: state machines, batching, error shape, resume walks.

The room Durable Object stays the product. They are a global pub/sub network. Different machine. Same client expectations.

## "We already have it" is not "as good as theirs"

| Area | Ably | Us today | Follow |
| --- | --- | --- | --- |
| Resume | String serial, history walk, buffer live events, discontinuity if the hole stays | Numeric lastSeq, WS resume fill, discontinuity 10200 | `client.room().attach` / `client.close()` |
| Reactions multiple | send `{ type, count }`; unique/distinct/multiple delete rules | REST + WS `planReactionMutation`; unique send replaces; multiple inserts N | — |
| Cursor history | Spaces REST page of past points; `getSelf` / `getOthers` | `await history()` pages in-session + DO `cursorHistory` on `/live` | hibernated DO trail is empty; not D1 |
| Connection | suspended vs failed, retryIn on the event | `suspended` (retry past N), `failed` (auth / max), retryIn on state_change | Keep degraded-http |
| Errors | Numeric catalog, ErrorInfo, `unable to op; reason` | `errors/catalog.json` → `FluxyErrorInfo` | `/docs/errors` |
| Cursors | Batch `{offset}` + inbound replay; skip if nobody listens | 100ms batch + dispense; `subscribe('update')` | DO skips solo rooms |
| AI stream | pipe tokens, append one message, resume missed deltas, stop any tab | Room timeline. Resume from `fromOffset`. Abort from any member | Two-tab E2E still open |
| HITL | Tools on the same session | Two-key HITL on the room (stronger) | Keep HITL; join it to stream resume |
| Occupancy | subscribe `{ occupancy }`; `{ unsubscribe }`; `enableEvents` default false (extra channel); `current` getter | same envelope + `watching`; `current()` / `current.connections` / `current.watching`; events default on (same socket) | `enableEvents: false` still drops frames |
| Connection | `chatClient.connection` + `realtime` + `ping()` + `whenState` | `client.connection` / `client.realtime` + ping + `whenState` | per-room `connectionStatus` stays |
| Room bag | `message.created/updated/deleted`; `Message.with`/`copy` | same envelopes + `messages.with`/`copy`; `text` alias | extras + unique/distinct |
| Room status | `room.status === "attached"` string getter + `onStatusChange` | `status()` / `status.current()` / `String(status)` + subscribe | `===` still needs `current()` |
| History | PaginatedResult + rewind by serial | `history` + `fromSerial` (`id > n`) + `beforeSerial` (`id < n`); `message.serial` | ISO `before` still works |
| React hooks | useTyping / useMessages / usePresenceListener / useOccupancy / useLock / useLocations | same names + `FluxyRoomProvider` | Two-tab stream E2E still open |
| Presence leave | `leave(data?)` without detach | `presence_leave` + optional data; socket stays | REST `/live` uses the same filter |
| Presence events | `{ type: enter\|leave\|update\|present, member }`; subscribe(type, listener) | same + type filter | wire names stay on `onAnyEvent` |
| Members | enter/leave/update/remove + offlineTimeout | `room.members` + leavers until `members.offlineTimeoutMs` | avatars still use the same TTL helpers |
| Locks | getSelf/getOthers locked-only | `getAll`/`getSelf`/`getOthers` skip pending; `get(id)` keeps pending | exclusive still one holder |
| Location | `member` / `currentLocation` / `previousLocation` | same aliases on `locations.subscribe` | Keep GPS as fleet |
| CLI | rooms:messages:send/history/update/delete/get/versions; reactions; presence get; occupancy get | `fluxy-room send/update/delete/get/react/unreact/reactions/versions/history/presence/occupancy` | Not a Control API |
| Message version | `Message.version.serial` skip older `with()` | stamp `version` + skip older/same serial | — |
| Attach | subscribe does not attach; `await attach()` waits for attached | `autoConnect: false` + attach waits; rejects on suspended/failed | `client.close()` / `dispose()` |
| Room options | `room.options` typing/occupancy/presence/messages | same slice from the live connection | occupancy events still default on |
| Presence filter | `subscribe('enter', fn)` | `subscribe(type\|types, listener)` | wire names stay on `onAnyEvent` |
| Locations event | `member` / `currentLocation` / `previousLocation` | same aliases on `locations.subscribe` | keep `userId` / `current` / `previous` |
| Chat UI Kit | occupancy “in chat vs watching”; typing 1 / 2 / N people; deleted placeholder; RoomReaction footer bursts | `ChatWindow` bursts + `useChat.roomReactions`; widget occupancy/edit/react; autoEnterPresence | — |
| Chat UI Kit 2 | ParticipantList; empty transcript; delete confirm; load older at top | `ParticipantList` + empty state + confirm + `loadMore` | — |
| ChatSettings | `allowMessageUpdatesOwn/Any`, deletes, reactions; room overrides | Provider + `ChatWindow` gates via `canUpdate/Delete/React` | wrap app to change defaults |
| MessageInput | emoji at caret; `onSendError`; auto-height max 150px; Enter send | same + textarea grow 150px | — |
| ChatMessageList | preserve scroll when loading older; `loadMoreThreshold` 150; `onMessageInView` | prepend restore + 150px + in-view receipts | — |
| ChatMessage time | clock on the message header | `MessageTimestamp` HH:mm | — |
| Sidebar | occupancy on rooms; collapse; empty “select a room”; add/leave | `ChannelList` occupancy + collapse + empty copy | — |
| ChatMessage | hover tooltip (name / clientId / time); ChatWindow `onError.sendMessage` | `formatSenderTooltip` + `connectionStatus` banner; kit send-error alert | — |
| Docs IA | Per-feature Chat + Spaces pages | Fumadocs `rooms/` (auth, messages, occupancy, cursors, UI kit) + cookbook in nav | examples/ sandboxes still Ably-only |
| Avatar stack | self first, isSelf ring, others, +N | `AvatarStack` `selfId` + overflow | — |
| Discontinuity UI | ChatWindow recovers after a hole; `onError` | `discontinuity` banner + `onError.discontinuity` | app still reloads history |

## Do in order

1. Error catalog + ErrorInfo
2. Resume gap walk + discontinuity + suspended/failed
3. Cursor batch
4. Stream offset resume + abort + two-tab test
5. Spec points + protocol integer on hello — done (`spec-points.md`, `protocol=1`)
6. Occupancy event
7. Operator CLI
8. ui_location + exclusive Room DO locks — done.

## Skip

Their fallback DNS mesh, Control API as a product, LiveObjects, MessagePack-as-must, twenty language SDKs.

Hosted is beta. Pin npm.
