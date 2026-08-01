/**
 * FluxyChat Activepieces piece — triggers + actions (PG-ZB-11).
 * Import as custom piece in self-hosted Activepieces (MIT, free).
 */
import { createPiece } from "@activepieces/pieces-framework";
import { fluxyChatAuth } from "./auth";
import { newMessageTrigger, handoffRequestedTrigger } from "./triggers";
import { sendMessageAction, createRoomAction } from "./actions";

export const fluxyChatPiece = createPiece({
  displayName: "FluxyChat",
  auth: fluxyChatAuth,
  minimumSupportedRelease: "0.20.0",
  logoUrl: "https://fluxychat.com/favicon.ico",
  authors: ["fluxychat"],
  actions: [sendMessageAction, createRoomAction],
  triggers: [newMessageTrigger, handoffRequestedTrigger],
});

export default fluxyChatPiece;
