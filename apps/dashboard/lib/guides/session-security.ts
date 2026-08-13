import type { GuideContent } from "@/lib/guides/types";

export const SESSION_SECURITY_GUIDE: GuideContent = {
  title: "Session security: storage, refresh, and token lifecycle",
  subtitle:
    "Best practices for managing FluxyChat sessions: secure token storage, refresh strategies, and preventing session fixation.",
  sections: [
    {
      id: "overview",
      title: "Session lifecycle",
      paragraphs: [
        "FluxyChat sessions consist of a short-lived access token (1 hour) and a longer-lived refresh token (30 days). The access token is used for API calls and WebSocket connections; the refresh token obtains new access tokens without re-authentication.",
      ],
    },
    {
      id: "storage",
      title: "Token storage strategies",
      bullets: [
        "Browser: store tokens in httpOnly, secure, SameSite=Strict cookies",
        "Avoid localStorage/sessionStorage for access tokens (XSS exposure)",
        "Mobile apps: use the platform secure storage (Keychain/Keystore)",
        "Never store tokens in URLs or query parameters",
        "Refresh tokens should be stored server-side when possible",
      ],
    },
    {
      id: "refresh",
      title: "Token refresh flow",
      paragraphs: [
        "When the access token expires, the SDK automatically calls POST /auth/refresh with the refresh token. If the refresh token is also expired, the user must re-authenticate.",
        "The SDK's FluxyRealtimeProvider handles refresh transparently. Configure refreshTokenBufferMs to refresh before expiry.",
      ],
      code: `// SDK auto-refresh configuration
<FluxyRealtimeProvider
  authTokenProvider={async () => {
    const res = await fetch("/api/auth/token");
    return res.json();
  }}
  refreshBufferMs={60_000}  // refresh 60s before expiry
>`,
    },
    {
      id: "fixation",
      title: "Preventing session fixation",
      paragraphs: [
        "FluxyChat rotates the refresh token on every use (refresh token rotation). If a stolen refresh token is used, the legitimate user's next refresh will fail, forcing re-authentication.",
        "Set REQUIRE_ADMIN_AUTH=true in production to prevent unauthenticated admin access.",
      ],
    },
  ],
  seoTopics: ["session security", "token storage", "refresh token", "session fixation", "cookies"],
};
