# Chatsemble -- conceptual notes (GPL, no code import)

Local clone: `docs/research/Chatsemble-main/` (AGPL/GPL workspace). **Do not copy source into FluxyChat.** Use this doc for product and integration ideas only.

## What Chatsemble is

- Multi-tenant **organization** scoped chat on Cloudflare (organization DO, room DO, agents, workflows, MCP).
- React Email templates for **auth and org invites** (`src/server/email/templates/`).
- In-room **agents** and tool-style workflows -- heavier than FluxyChat’s “agent in a room” wedge.

## What we already cover (FluxyChat)

| Chatsemble idea | FluxyChat equivalent |
|-----------------|----------------------|
| Room-scoped realtime | `RoomDurableObject` + SDK |
| Members + roles | `room_members`, JWT roles |
| Agents in rooms | `@mention` invoke, tool events on same WS |
| Mention notify | `in_app_notifications` + webhooks |
| Invite / onboarding email | **Your** stack (Clerk, Resend, etc.) -- not bundled |
| Org-wide document AI | Out of wedge -- use external RAG |

## Safe to borrow (design only)

1. **Transactional email layout** -- clear CTA, “ignore if unexpected” copy (see `organization-invitation.tsx` structure). Reimplement with your provider; do not copy JSX/styles verbatim if license is unclear for snippets.
2. **Member list on room join** -- snapshot on connect (we send `history` / `replay` + presence).
3. **Separate “workspace” from “room”** -- FluxyChat uses `project_id` + `room_id`; document tenant boundaries in your app, not a second GPL codebase.

## Do not import

- Organization DO schema, workflow engine, or MCP server code.
- GPL agent/workflow UI.
- Any file from `Chatsemble-main` into `apps/` or `packages/`.

## Pairing with FluxyChat

- **In-app:** FluxyChat WS + notifications.
- **Email invite:** Clerk organizations or Resend -- pattern similar to Chatsemble templates.
- **SMS offline:** [Sent.dm cookbook](../cookbook/offline-notify-sent-dm.md).

## Compare page

We reference Chatsemble only as a **category** (“full GPL workspace”) on `/compare`, not as a dependency or recommended migration path.
