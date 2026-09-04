# FluxyChat polls

First-class room polls: `createPoll` / `votePoll` on the chat timeline.

Anonymous ballots (voter ids omitted from results) are a separate HTTP path: `POST /polls` with `isAnonymous: true`, then `POST /polls/:id/close`. That is not `createPoll`.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-polls --example polls
cp .env.example .env
npm run dev
```

Fastest path: `VITE_FLUXYCHAT_WORKER_URL` + `VITE_FLUXYCHAT_PUBLISHABLE_KEY` (`pk_`) + a public room id. Pin `@fluxy-chat/sdk@0.6.7` and `@fluxy-chat/react@0.1.6` once those versions are on npm.
