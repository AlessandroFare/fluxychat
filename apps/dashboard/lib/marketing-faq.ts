/** Landing page FAQ — written for humans, SEO keywords kept natural. */
export const LANDING_FAQ = [
  {
    q: "What is the chat API vs the SDK?",
    a: "Your backend talks to the Worker over HTTP. The browser uses @fluxy-chat/sdk to join a room, send, and render. Same product, two surfaces.",
  },
  {
    q: "Can I keep the frontend on Vercel?",
    a: "Yes. Lots of teams leave Next on Vercel or Netlify and run chat on Workers + Durable Objects. You skip the platform WebSocket limits and a second Pusher-style bill.",
  },
  {
    q: "Is this a Pusher or Ably replacement?",
    a: "For tenant-scoped in-app chat on the edge, usually yes: rooms, history, reconnect, operator tools. For generic pub/sub or SMS/WhatsApp, keep those products and use FluxyChat for the chat slice.",
  },
  {
    q: "How is this different from a fully managed vendor?",
    a: "You can run the Worker and D1 in your Cloudflare account, read the MIT source, and control upgrades. Hosted cloud is there when you do not want to wire infra on day one.",
  },
  {
    q: "Is this Intercom or Zendesk?",
    a: "No. This is the plumbing for rooms, SDK, and webhooks. You build the support UI or in-app inbox on top.",
  },
  {
    q: "Can I add moderation and webhooks?",
    a: "Yes. Middleware on the edge, signed webhooks, and console pages for the boring admin work.",
  },
  {
    q: "What are Durable Objects for chat?",
    a: "Cloudflare puts shared state in a DO — chat rooms are the textbook case. FluxyChat uses one Room object per room and D1 for history. Guide: /guides/durable-objects-for-chat-rooms.",
  },
  {
    q: "Humans and AI agents in the same room?",
    a: "tool_call and tool_result ride the same WebSocket as user messages, so you replay one timeline instead of guessing what the agent did. Guide: /guides/agent-events-same-websocket-stream.",
  },
  {
    q: "I finished Cloudflare's chat tutorial — now what?",
    a: "That tutorial is the right start. FluxyChat adds JWT, D1 history, reconnect in the SDK, and a console — /guides/after-cloudflare-chat-tutorial.",
  },
  {
    q: "Why not stay on Pusher?",
    a: "You might not need to. Edge pricing you can read, self-host on your account, no socket VPS fleet. Compare at /compare.",
  },
  {
    q: "Where should I start?",
    a: "Run the quickstart for a JWT and first room, or read /guides if you are still picking between DIY Workers chat and a packaged layer.",
  },
  {
    q: "Does a public dashboard mean anyone can spend my quota?",
    a: "No. Billable calls need your JWTs and API keys. Turn on DASHBOARD_ACCESS_MODE=ack (and optional CONSOLE_GATE_SECRET) so console routes need a one-time ack first.",
  },
] as const;
