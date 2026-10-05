# FluxyChat negotiation room

Two counterparties and their agents in one room. Clause policy is three levels: **auto**, **ask** (HITL in the room), **deny**. This is not Harvey. It is for smaller legal or procurement tools that need a cross-org room without building one.

Same two-tab path as deal-room (`?seat=counsel`). Guest room for whispers.

```bash
npx @fluxy-chat/create-fluxy-chat@latest my-nda --example negotiation-room
```

Pin room HITL with maker-checker (requester cannot approve; agent cannot approve) in `fluxy.config.ts`:

```ts
rooms: {
  "nda-*": { makerChecker: true },
}
agents: {
  "bot-legal": { toolApproval: "user-approval", toolAutonomy: "act-with-approval" },
}
```
