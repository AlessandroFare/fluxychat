import type { GuideContent } from "@/lib/guides/types";

export const WEBHOOK_SIGNING_GUIDE: GuideContent = {
  title: "Webhook signing and verification",
  subtitle:
    "Verify that webhook payloads came from FluxyChat using HMAC-SHA256 signatures.",
  sections: [
    {
      id: "overview",
      title: "Why sign webhooks?",
      paragraphs: [
        "Webhooks allow FluxyChat to notify your backend about events like new messages, agent runs, or reactions. Without signature verification, an attacker could send fake webhook payloads to your endpoint.",
        "FluxyChat signs every webhook with HMAC-SHA256 using a shared secret. Your backend must verify the signature before processing the payload.",
      ],
    },
    {
      id: "configuration",
      title: "Setting up webhook signing",
      bullets: [
        "Generate a strong secret (32+ random bytes, base64-encoded)",
        "Set WEBHOOK_SECRET_ENCRYPTION_KEY in your worker env for at-rest encryption",
        "Each webhook subscription stores its own signing secret (encrypted in D1)",
        "The signature is sent in the X-FluxyChat-Signature header",
      ],
    },
    {
      id: "verification",
      title: "Verifying signatures",
      paragraphs: [
        "The signature header contains the HMAC-SHA256 of the raw request body, hex-encoded. Compare it using a constant-time comparison to prevent timing attacks.",
      ],
      code: `import crypto from "crypto";

function verifyWebhook(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}`,
    },
    {
      id: "replay-protection",
      title: "Replay protection",
      paragraphs: [
        "Each webhook includes a timestamp in the X-FluxyChat-Timestamp header. Reject webhooks older than 5 minutes to prevent replay attacks. The timestamp is included in the signed payload.",
      ],
    },
  ],
  seoTopics: ["webhook signing", "hmac", "verification", "security", "replay protection"],
};
