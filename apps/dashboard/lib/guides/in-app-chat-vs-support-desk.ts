import type { GuideContent } from "@/lib/guides/types";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";

export const IN_APP_CHAT_VS_SUPPORT_DESK_GUIDE: GuideContent = {
  title: "In-app chat vs support desk",
  subtitle:
    "Intercom-style roundups are written for support teams. FluxyChat is the room layer you embed in your SaaS: SDK, history, webhooks, agent timeline. Not a helpdesk replacement.",
  sections: [
    {
      title: "Two different products",
      bullets: [
        "Support desk: shared inbox, tickets, CSAT, macros, help-center widget.",
        "In-app chat infra: tenant rooms, JWT members, WebSocket transport, D1 history, your UI.",
        "FluxyChat is the second. You can still build support on top. See docs/use-cases/support-chat.md.",
      ],
    },
    {
      title: "Same benefits, different buyer",
      paragraphs: [
        "Articles about live chat often talk about onboarding and retention inside the product. That applies to embedded chat too. The buyer is just different: your engineering team shipping messaging in the app, not a CS lead shopping for a helpdesk.",
        "FluxyChat is for builders who want a chat layer on Cloudflare they can self-host. Not a full support suite.",
      ],
    },
    {
      title: "Humans, agents, and CRM hooks",
      bullets: [
        "Users describe what they want in chat; your agent calls tools or external APIs.",
        "tool_call and tool_result ride the same WebSocket as user messages. One timeline to replay.",
        "Pair with whatever integration runner you use (MCP, CLI skills, webhooks) for Salesforce, HubSpot, etc.",
      ],
      link: {
        href: MARKETING_GUIDE_PATHS.agentEventsSameStream,
        title: "Agent events on the same WebSocket stream",
      },
    },
    {
      title: "When you actually need a helpdesk",
      paragraphs: [
        "If you need ticketing, SLA queues, and a standalone support portal on day one, look at Intercom-style or Libredesk-style products. FluxyChat replaces the socket layer when chat lives inside your product UI, not the whole support operation.",
      ],
    },
    {
      title: "Search intent (for your own landing copy)",
      bullets: [
        "Good fit: embedded chat for SaaS, in-app chat platform, Pusher alternative, realtime chat in Next.js.",
        "Usually wrong fit: best live chat software, Zendesk alternatives, unless you want support-team traffic.",
        "More detail on /compare and /why#product-chat.",
      ],
    },
  ],
  seoTopics: [
    "in-app chat platform",
    "embedded chat for saas",
    "product chat vs support chat",
    "intercom alternative infrastructure",
    "not a helpdesk",
  ],
};

