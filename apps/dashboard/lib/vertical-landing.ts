export interface VerticalLandingPage {
  slug: "incident" | "support" | "pr-review";
  title: string;
  eyebrow: string;
  lede: string;
  scaffold: string;
  sections: Array<{ heading: string; body: string }>;
}

export const VERTICAL_LANDINGS: VerticalLandingPage[] = [
  {
    slug: "incident",
    title: "Incident room",
    eyebrow: "Ops",
    lede:
      "One room for the people on call and an agent that can summarize the last hour. It is still chat on a Durable Object, not PagerDuty.",
    scaffold: "npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room",
    sections: [
      {
        heading: "What you get",
        body: "Two-tab presence, invokeAgent on the same WebSocket, optional HITL when a tool can page or write. Feeds stay a log, not the transcript.",
      },
      {
        heading: "What you bring",
        body: "Your status page, your ticket system, your on-call rota. We do not pretend the room is an incident commander.",
      },
    ],
  },
  {
    slug: "support",
    title: "Support copilot with a human",
    eyebrow: "Support",
    lede:
      "The bot drafts in the room. A human can stop the stream, deny a tool, or take the thread. Handoff is a queue, not a magic escalate button.",
    scaffold: "npx @fluxy-chat/create-fluxy-chat@latest my-room --example shared-ai-room",
    sections: [
      {
        heading: "What you get",
        body: "Guest pk_ or member JWT, Ask agent / Stop on the widget, approval chain for tools that send mail or mutate records.",
      },
      {
        heading: "What you bring",
        body: "Zendesk/Intercom stay your system of record unless you wire a bridge. This page is the in-app room, not a helpdesk SKU.",
      },
    ],
  },
  {
    slug: "pr-review",
    title: "PR review room",
    eyebrow: "Engineering",
    lede:
      "Reviewers and an agent share one timeline. Import is a JSON export you already have, not scraping GitHub.",
    scaffold: "npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room",
    sections: [
      {
        heading: "What you get",
        body: "Same pattern as deal-room: seats, whispers, invokeAgent. POST /rooms/import-transcript if you dump a chat export into a room.",
      },
      {
        heading: "What you bring",
        body: "GitHub Checks, CODEOWNERS, CI. We do not ship a GitHub App. deal-room is the closest gallery app; there is no pr-review template yet.",
      },
    ],
  },
];

export function verticalLandingBySlug(slug: string) {
  return VERTICAL_LANDINGS.find((page) => page.slug === slug) ?? null;
}
