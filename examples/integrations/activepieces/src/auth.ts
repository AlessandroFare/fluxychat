import { PieceAuth } from "@activepieces/pieces-framework";

export const fluxyChatAuth = PieceAuth.SecretText({
  displayName: "FluxyChat webhook secret",
  required: true,
  description: "Verify inbound webhooks with X-Fluxy-Signature (HMAC-SHA256)",
});
