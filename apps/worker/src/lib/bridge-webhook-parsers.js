/**
 * CP-064: Bridge webhook payload parsers (shared by routes + replay emulators).
 */

export function parseSlackWebhookBody(body) {
  if (body.type === "url_verification") {
    return { kind: "challenge", challenge: body.challenge };
  }
  const event = body.event;
  if (!event || event.type !== "message" || event.subtype) {
    return { kind: "ignored" };
  }
  return {
    kind: "message",
    externalMessageId: event.ts || event.client_msg_id || `slack_${Date.now()}`,
    externalChannelId: event.channel,
    externalUserId: event.user,
    externalUsername: event.username || event.user,
    content: event.text || "",
    timestamp: event.ts ? new Date(Number(event.ts) * 1000).toISOString() : new Date().toISOString(),
  };
}

export function parseDiscordWebhookBody(body) {
  if (!body.content && !body.message?.content) {
    return { kind: "ignored" };
  }
  const msg = body.message ?? body;
  return {
    kind: "message",
    externalMessageId: msg.id || `discord_${Date.now()}`,
    externalChannelId: msg.channel_id || body.channel_id,
    externalUserId: msg.author?.id || body.author?.id,
    externalUsername: msg.author?.username || "discord-user",
    content: msg.content || "",
    timestamp: msg.timestamp || new Date().toISOString(),
  };
}

/**
 * @param {*} transaction Matrix appservice transaction body
 */
export function summarizeMatrixTransaction(transaction) {
  const events = Array.isArray(transaction?.events) ? transaction.events : [];
  const messages = events.filter((e) => e?.type === "m.room.message" && e?.content?.msgtype === "m.text");
  return {
    transactionId: transaction?.transactionId ?? transaction?.transaction_id ?? null,
    eventCount: events.length,
    messageCount: messages.length,
  };
}
