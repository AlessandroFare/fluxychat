/** Landing page FAQ — SEO-oriented objections from builder threads. */
export const LANDING_FAQ = [
  {
    q: "What is the chat API vs the SDK?",
    a: "Your backend calls the Worker over HTTP. The browser uses @fluxy-chat/sdk to subscribe, send, and render. Same product, two surfaces.",
  },
  {
    q: "Can I deploy the frontend on Vercel and chat on Cloudflare?",
    a: "Yes — that is a common split. Vercel/Netlify handle SSR and static assets; FluxyChat runs WebSockets and room state on Workers + Durable Objects so you are not fighting platform WebSocket limits or pricing surprises.",
  },
  {
    q: "Is FluxyChat a Pusher or Ably alternative?",
    a: "For in-app tenant chat on the edge, yes: room history, JWT auth, reconnect, and operator tools without a separate socket vendor SKU. For generic pub/sub or telco SMS/WhatsApp, use those products alongside FluxyChat.",
  },
  {
    q: "How is this different from a fully managed vendor?",
    a: "You can run the Worker and D1 in your Cloudflare account. Data stays where you deploy it, and you control upgrades. Hosted cloud is there when you want to skip infra on day one.",
  },
  {
    q: "Is this a helpdesk or Intercom replacement?",
    a: "No. FluxyChat is the chat infrastructure layer (rooms, SDK, webhooks). You build your own support UI or in-app messaging product on top — not a full ticketing stack.",
  },
  {
    q: "Can I add moderation and webhooks?",
    a: "Yes. Run middleware on the edge, sign webhooks for downstream systems, and use the console for admin tasks.",
  },
  {
    q: "What are Durable Objects for chat rooms?",
    a: "Official Cloudflare docs describe DOs for shared state coordination — chat rooms, games, collaborative docs. FluxyChat uses one Room DO per room plus D1 history. See /guides/durable-objects-for-chat-rooms.",
  },
  {
    q: "Humans and AI agents in the same room?",
    a: "Yes — tool_call and tool_result share the room WebSocket with user messages so support and operators can replay one timeline. See /guides/agent-events-same-websocket-stream.",
  },
  {
    q: "I finished Cloudflare’s chat tutorial — what’s next?",
    a: "The official walkthrough is the right start. FluxyChat adds JWT, D1 history, reconnect SDK, and console — /guides/after-cloudflare-chat-tutorial.",
  },
  {
    q: "Why Cloudflare instead of another Pusher bill?",
    a: "Edge pricing you can read, self-host on your account, no socket VPS fleet — you control lock-in. Compare at /compare.",
  },
  {
    q: "Where should I start?",
    a: "Quickstart wizard for a JWT and first room, or /guides if you are still researching cloudflare workers websocket and durable objects chat patterns.",
  },
  {
    q: "Does a public dashboard mean public spend?",
    a: "No. Billable calls need your JWTs and API keys on the Worker. Enable DASHBOARD_ACCESS_MODE=ack (and optional CONSOLE_GATE_SECRET) so console routes require a one-time acknowledgment first.",
  },
] as const;
