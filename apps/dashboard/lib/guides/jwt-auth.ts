import type { GuideContent } from "@/lib/guides/types";

export const JWT_AUTH_GUIDE: GuideContent = {
  title: "JWT Authentication for self-hosted FluxyChat",
  subtitle:
    "Configure JWT-based auth for your FluxyChat worker without external identity providers — issue, refresh, and verify tokens.",
  sections: [
    {
      id: "overview",
      title: "How JWT auth works in FluxyChat",
      paragraphs: [
        "FluxyChat uses HMAC-signed JWTs to authenticate WebSocket connections and REST API calls. Each project has its own jwt_secret stored in the project_secrets table. Tokens are issued on login and verified on every request.",
        "The worker's verifyJwtAndGetContext middleware extracts the project ID, user ID, and roles from the token, then enforces per-project isolation.",
      ],
    },
    {
      id: "issuing-tokens",
      title: "Issuing JWT tokens",
      paragraphs: [
        "Tokens are issued via the POST /auth/session endpoint. The worker signs them with the project's jwt_secret and returns a short-lived access token plus a refresh token.",
      ],
      code: `POST /auth/session
{
  "projectId": "your-project-id",
  "userId": "user_123",
  "roles": ["member"]
}

Response:
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600
}`,
    },
    {
      id: "verification",
      title: "Token verification",
      bullets: [
        "Every REST request must include Authorization: Bearer <token>",
        "WebSocket connections pass the token as a query parameter: /ws?roomId=...&token=...",
        "The worker verifies the signature, checks expiry, and extracts projectId/userId",
        "Expired tokens return 401 — the client should refresh automatically",
      ],
    },
    {
      id: "rotation",
      title: "Secret rotation",
      paragraphs: [
        "To rotate the jwt_secret without invalidating all active sessions, set JWT_SECRET_PREVIOUS in your worker env. The worker accepts tokens signed with either the current or previous secret. Set JWT_SECRET_PREVIOUS_EXPIRES_AT to a future ISO timestamp after which the old secret is rejected.",
      ],
    },
  ],
  seoTopics: ["jwt auth", "authentication", "self-hosted", "token verification", "secret rotation"],
};
