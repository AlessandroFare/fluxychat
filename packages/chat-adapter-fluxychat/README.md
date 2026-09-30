# chat-adapter-fluxychat

Community adapter for [Vercel Chat SDK](https://chat-sdk.dev). Package name is unscoped because `@chat-adapter/*` is reserved.

`listThreads` maps Worker rooms to `fluxychat:{roomId}`. `chat` is an **optional** peer (`^4`). The factory is duck-typed: `createFluxyChatSdkAdapter` / `createFluxyChatAdapter`.

## Listing on chat-sdk.dev

That page only updates when someone merges an entry into [vercel/chat `apps/docs/adapters.json`](https://github.com/vercel/chat). Copy `listing/adapters.entry.json` into that PR. Pin `readme` to a **commit or tag**, not `main`. Publish this package to npm first. We are not listed until that PR lands.

See FluxyChat docs: Chat SDK adapter.
