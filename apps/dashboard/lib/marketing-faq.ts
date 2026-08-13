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
    q: "Is this Intercom, Zendesk, or a live-chat widget?",
    a: "No. Those are support desks. FluxyChat is the room layer for chat inside your app: SDK, webhooks, agent timeline. You build the UI. Guide: /guides/in-app-chat-vs-support-desk.",
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
    q: "Can I add moderation and webhooks?",
    a: "Yes. Middleware on the edge, signed webhooks, and console pages for the boring admin work.",
  },
  {
    q: "What are Durable Objects for chat?",
    a: "Cloudflare puts shared state in a Durable Object. Chat rooms are the textbook case. FluxyChat uses one Room object per room and D1 for history. Guide: /guides/durable-objects-for-chat-rooms.",
  },
  {
    q: "Humans and AI agents in the same room?",
    a: "tool_call and tool_result ride the same WebSocket as user messages, so you replay one timeline instead of guessing what the agent did. Streaming markdown with table buffering and code fence tracking renders cleanly during AI responses. Guide: /guides/agent-events-same-websocket-stream.",
  },
  {
    q: "What platforms do the multi-platform adapters support?",
    a: "14 platforms behind a unified interface: Slack, Discord, Telegram, WhatsApp, Microsoft Teams, Email, SMS, Webhook, Matrix, and more. Each adapter handles platform-specific formatting, and the card builder renders Slack Block Kit and Teams Adaptive Cards natively.",
  },
  {
    q: "What is MCP and how does FluxyChat use it?",
    a: "Model Context Protocol lets your agents consume external tool servers. FluxyChat acts as an MCP client and auto-converts tools to LLM function-calling format. Point your agent at any MCP-compatible server.",
  },
  {
    q: "Can I add guardrails or RAG to AI responses?",
    a: "Yes. The LLM middleware pipeline supports wrapGenerate, wrapStream, and transformParams hooks. Plug in guardrails, caching, RAG injection, PII redaction, or logging on the edge before responses reach users.",
  },
  {
    q: "Does WorkflowAgent survive deploys?",
    a: "Yes. WorkflowAgent persists state to D1 after each step. If the Worker restarts or you deploy a new version, the agent resumes from the last completed step.",
  },
  {
    q: "I finished Cloudflare's chat tutorial. Now what?",
    a: "That tutorial is the right start. FluxyChat adds JWT, D1 history, reconnect in the SDK, and a console. See /guides/after-cloudflare-chat-tutorial.",
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

