# @portalsdk/core

The framework-agnostic Portal client. It manages realtime channels and a per-user inbox
over a WebSocket, and exposes reactive, `useSyncExternalStore`-shaped stores you can bind to
any UI. Client-only — meant to run in a browser, not inside server code.

This package has no React dependency, so it doesn't ship (or need) the `"use client"`
directive itself. That directive only matters for `@portalsdk/react` — its dist carries it,
since its hooks are the actual React Client Component boundary.

For React, use [`@portalsdk/react`](https://www.npmjs.com/package/@portalsdk/react), which is
a thin hook layer over this package.

## Install

```sh
npm install @portalsdk/core
```

## Quickstart

```ts
import { Portal } from "@portalsdk/core";

// Construction is synchronous and passive — no network until the first acquire().
const portal = new Portal({
  apiKey: "pk_live_…",              // publishable; safe in the bundle
  token: async () => fetchJwt(),    // your signed user token (or a static string)
});

const channel = portal.channel<{ text: string }>("room-7");

// Refcounted: the first acquire() opens the connection, the last release() tears it down.
channel.acquire();

const unsubscribe = channel.subscribe(() => {
  const { messages, status } = channel.getSnapshot();
  render(status, messages);
});

await channel.send({ content: { text: "hello" } });

// later…
unsubscribe();
channel.release();
```

`portal.channel(id)` returns the same handle for the same id, so many views of a room share
one socket. In vanilla JS you pair `acquire()`/`release()` yourself (or use
`using ch = portal.channel(id)` for scope-bound release); React does it for you.

## Anonymous & auth

`token` is optional. Omit it and the client runs anonymously: it mints and manages its own
anonymous credential on first use, reuses it everywhere, and keeps one stable anonymous
identity across refreshes — no token wrangling on your side.

```ts
const portal = new Portal({ apiKey: "pk_live_…" }); // anonymous

// Later, on login — live channels and the inbox re-authenticate cleanly:
portal.setToken(async () => fetchJwt());

// On logout — back to anonymous:
portal.setToken(undefined);
```

Anonymous users get `me.anon === true`, an empty inbox, and are refused from channels marked
`anonymous: false` (`AnonymousNotAllowedError`).

## Channels

A `ChannelHandle` exposes a reactive window and the operations over it:

- `messages` — the seq-ordered message window; retractions apply in place.
- `send(input)` — one form. A persistent send resolves once the edge accepts it (`status`
  runs `pending → sent`); an ephemeral send (`{ ephemeral: true, … }`) resolves immediately
  and is fire-and-forget.
- `loadPrevious()` / `hasPrevious` / `isLoadingPrevious` — backwards history paging.
- `presence` — `{ kind: "detailed", participants, count }` on standard channels, or
  `{ kind: "aggregate", count, recent }` on broadcast channels.
- `activity` / `sendActivity(kind)` / `typing` / `sendTyping()` — transient per-user signals.
- `unread` / `markAsRead()` — the channel read position.
- `members()` — the fetched member directory (standard channels).
- `status` — `idle | connecting | ready | reconnecting | degraded | degraded-http | blocked`.
- `on(event, fn)` — `message`, `mention`, `retract`, `presence`, `activity`, `status`.
- `subscribe(listener)` / `getSnapshot()` — the external-store contract.

Content types are per call site: `portal.channel<M>(id)`.

## Inbox

```ts
const inbox = portal.inbox(); // lazy singleton, connects on first use

inbox.subscribe(() => {
  const { channels, items, counter } = inbox.getSnapshot();
  renderBadge(counter);
});

// A filtered view — scope to a channel and/or filter the item feed.
const mentions = inbox.view({ where: { type: { eq: "mention" } } });
```

Channels are positional (each has a watermark and `unread`); items are per-item
(`read` / `markAsRead()`). `counter` is the global badge. Anonymous users get a
permanently-empty ready inbox, so calling code needs no special case.

Each item's `id` **is** the notification's idempotency key — whatever key was supplied when
the notification was sent arrives back unchanged as `InboxItem.id`. That makes it the right
thing to dedupe on (or key a list by) when reacting to arrivals, since a redelivered id is the
same event, not a new one.

## Errors

Every failure is a `PortalError` with a stable `code`. Named subclasses cover the cases you
react to differently: `InvalidApiKeyError`, `TokenExpiredError`, `NotMemberError`,
`ChannelAtCapacityError`, `AnonymousNotAllowedError`, `BlockedError` (a rejected send, with a
user-visible `reason`), `NotYetSupportedError`, `DegradedError`. `send()` rejects with the
relevant one; connection-level refusals arrive on the `status` event and move `status` to
`blocked`.

## Size

~14 kB min+gzip. Runtime dependencies: `@portalsdk/wire-protocol` and `partysocket`.

## License

MIT
