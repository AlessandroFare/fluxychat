import { isKnownOutboundClientEvent } from "@fluxychat/protocol";

/**
 * Reject unknown client WebSocket payloads before Room DO handlers run.
 * Returns true when the frame should be processed.
 */
export function isValidClientWsPayload(msg) {
  return isKnownOutboundClientEvent(msg);
}
