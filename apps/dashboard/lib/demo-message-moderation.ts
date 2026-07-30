/** Lightweight client-side filters for the public /demo room (UX layer; worker still enforces limits). */

const SPAM_PATTERNS = [
  /(.)\1{8,}/i,
  /(https?:\/\/[^\s]+){3,}/i,
  /\b(buy now|click here|free money|crypto pump)\b/i,
];

const PROFANITY_STUB = /\b(badword|spamscam)\b/i;

export interface DemoModerationVerdict {
  hidden: boolean;
  reason?: "spam" | "profanity" | "reported" | "flooded";
}

export function evaluateDemoMessage(content: string): DemoModerationVerdict {
  const text = content.trim();
  if (!text) return { hidden: false };
  if (text.length > 2000) return { hidden: true, reason: "spam" };
  if (SPAM_PATTERNS.some((re) => re.test(text))) return { hidden: true, reason: "spam" };
  if (PROFANITY_STUB.test(text)) return { hidden: true, reason: "profanity" };
  return { hidden: false };
}

export function shouldHideDemoMessage(options: {
  content: string;
  userId: string;
  messageId: number | null | undefined;
  localUserId: string | null;
  reportedIds: ReadonlySet<number>;
}): DemoModerationVerdict {
  if (options.messageId != null && options.reportedIds.has(options.messageId)) {
    return { hidden: true, reason: "reported" };
  }
  if (options.localUserId && options.userId === options.localUserId) {
    return { hidden: false };
  }
  return evaluateDemoMessage(options.content);
}

export const DEMO_SEND_COOLDOWN_MS = 2_500;
