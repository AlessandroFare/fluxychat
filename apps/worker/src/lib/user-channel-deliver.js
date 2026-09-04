/**
 * Inbox-only sockets (`c: "inbox"`) receive inbox_updated plus handshake,
 * not arbitrary user_event names.
 */
export function shouldDeliverOnUserSocket(channel, message) {
  if (channel !== "inbox") return true;
  if (message?.type === "inbox_subscription_succeeded") return true;
  if (message?.type === "user_subscription_succeeded") return false;
  if (message?.type === "user_event") {
    return message.name === "inbox_updated" || message.name === "inbox_item";
  }
  return false;
}

export function isInboxChannelRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("channel") === "inbox") return true;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.includes("inbox");
  } catch {
    return false;
  }
}
