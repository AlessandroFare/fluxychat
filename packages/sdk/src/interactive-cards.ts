import { cardToFallbackText, isCardElement, type AnyCardElement, type CardElement } from "./cards";

const CARD_MARKER_START = "<!--fluxy-card:v1-->";
const CARD_MARKER_END = "<!--/fluxy-card-->";

export function serializeCardMessage(card: CardElement, fallbackText?: string): string {
  const fallback = fallbackText ?? cardToFallbackText(card);
  return `${CARD_MARKER_START}\n${JSON.stringify(card)}\n${CARD_MARKER_END}\n${fallback}`;
}

export function parseCardFromContent(content: string | undefined | null): CardElement | null {
  if (!content) return null;
  const start = content.indexOf(CARD_MARKER_START);
  const end = content.indexOf(CARD_MARKER_END);
  if (start === -1 || end === -1 || end <= start) return null;
  const json = content.slice(start + CARD_MARKER_START.length, end).trim();
  try {
    const parsed = JSON.parse(json) as unknown;
    if (isCardElement(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && (parsed as CardElement).type === "card") {
      return parsed as CardElement;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseCardFromMessage(message: {
  content?: string | null;
  card?: CardElement | null;
}): CardElement | null {
  if (message.card && isCardElement(message.card)) return message.card;
  return parseCardFromContent(message.content);
}

export function isCardMessage(message: { content?: string | null; card?: CardElement | null }): boolean {
  return parseCardFromMessage(message) !== null;
}

export function cardDisplayText(message: { content?: string | null; card?: CardElement | null }): string {
  const card = parseCardFromMessage(message);
  if (card) return cardToFallbackText(card);
  const content = message.content ?? "";
  const end = content.indexOf(CARD_MARKER_END);
  if (end !== -1) return content.slice(end + CARD_MARKER_END.length).trim();
  return content;
}

export type { AnyCardElement, CardElement };
