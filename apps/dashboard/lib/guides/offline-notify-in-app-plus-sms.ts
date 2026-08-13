import type { GuideContent } from "./types";

export const OFFLINE_NOTIFY_IN_APP_PLUS_SMS_GUIDE: GuideContent = {
  title: "In-app chat + SMS when users are offline",
  subtitle:
    "Keep FluxyChat for realtime rooms and webhooks; fan out transactional SMS or WhatsApp with Sent.dm when your app decides the user is not active.",
  sections: [
    {
      id: "split",
      title: "Split transport by context",
      paragraphs: [
        "FluxyChat is room-based in-app transport: WebSocket history, mentions, agents on the same stream. Telco APIs (Sent.dm, Twilio, etc.) are for offline reach (password resets, mention alerts, DM summaries), not for replacing your message list UI.",
      ],
      bullets: [
        "Online: FluxyChat WS + optional in-app notification inbox",
        "Offline: webhook consumer → Sent.dm template send",
        "Never expose telco API keys to the browser",
      ],
    },
    {
      id: "webhook",
      title: "Webhook-driven fan-out",
      paragraphs: [
        "Subscribe to message.created on your project. Verify X-Fluxy-Signature, resolve the recipient’s phone from your user profile, and skip send when your own presence or read-receipt logic says they are active.",
      ],
      code: `// See docs/cookbook/offline-notify-sent-dm.md for full Worker example
await fetch("https://api.sent.dm/v3/messages", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${env.SENT_DM_API_KEY}\`,
    "x-profile-id": env.SENT_PROFILE_ID,
  },
  body: JSON.stringify({
    channel: ["sms"],
    to: [user.e164],
    template: { name: "chat_mention", parameters: { sender, preview } },
  }),
});`,
    },
    {
      id: "chatsemble",
      title: "Workspace apps vs chat wedge",
      paragraphs: [
        "Full GPL workspaces bundle email invites and org-wide AI. FluxyChat stays MIT and room-scoped: use Clerk or Resend for invite email, Sent.dm for SMS, and our in-app notification rows for mentions inside the product.",
      ],
      link: {
        href: "/guides/in-app-chat-vs-support-desk",
        title: "In-app chat vs support desk",
      },
    },
    {
      id: "demo",
      title: "Harden public demos",
      paragraphs: [
        "If you expose a guest demo room, combine Turnstile, origin allowlist, and per-IP rate limits so bots cannot mint JWTs indefinitely.",
      ],
      link: {
        href: "/demo",
        title: "Live demo room",
      },
    },
  ],
  seoTopics: [
    "in-app chat SMS notification",
    "Sent.dm FluxyChat",
    "webhook message.created",
    "offline push chat",
    "transactional SMS mention",
  ],
};

