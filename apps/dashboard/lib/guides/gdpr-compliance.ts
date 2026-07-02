import type { GuideContent } from "@/lib/guides/types";

export const GDPR_COMPLIANCE_GUIDE: GuideContent = {
  title: "GDPR compliance and data retention",
  subtitle:
    "Export, anonymize, and delete user data to comply with GDPR and privacy regulations.",
  sections: [
    {
      id: "overview",
      title: "GDPR in FluxyChat",
      paragraphs: [
        "FluxyChat stores user data in Cloudflare D1 (messages, reactions, room memberships) and R2 (attachments, voice messages, AI-generated images). To comply with GDPR, you must be able to export, anonymize, and delete user data on request.",
      ],
    },
    {
      id: "export",
      title: "Data export",
      bullets: [
        "GET /users/:userId/export — returns all user data as JSON",
        "Includes messages, reactions, room memberships, and file metadata",
        "Attachments can be downloaded via their R2 URLs",
        "Export is rate-limited to once per 24 hours per user",
      ],
      code: `const res = await fetch(\`/users/\${userId}/export\`, {
  headers: { Authorization: \`Bearer \${token}\` },
});
const data = await res.json();`,
    },
    {
      id: "deletion",
      title: "Right to be forgotten",
      paragraphs: [
        "DELETE /users/:userId permanently deletes all user data. This operation is irreversible:",
      ],
      bullets: [
        "Soft-deletes all messages (content replaced, deleted_at set)",
        "Hard-deletes all reactions and read receipts",
        "Removes user from all room memberships",
        "Deletes user's attachments from R2",
        "Anonymizes the user record (name, avatar, metadata cleared)",
        "Preserves audit trail (user_id retained for compliance, but no PII)",
      ],
    },
    {
      id: "retention",
      title: "Data retention policies",
      paragraphs: [
        "Configure retention via the dashboard or API:",
      ],
      bullets: [
        "Set message_expires_at on individual messages for ephemeral chats",
        "Use AUTO_ROOM_SUMMARY_ENABLED to summarize old messages (reduces storage)",
        "Run scheduled cleanup via cron: DELETE FROM messages WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')",
        "R2 objects can be configured with lifecycle rules for auto-expiration",
      ],
    },
    {
      id: "audit",
      title: "Audit trail",
      paragraphs: [
        "FluxyChat logs all admin actions (user deletion, key rotation, config changes) with timestamps and actor IDs. Access audit logs via GET /admin/audit-log.",
      ],
    },
  ],
  seoTopics: ["gdpr", "data retention", "data export", "deletion", "privacy", "compliance"],
};
