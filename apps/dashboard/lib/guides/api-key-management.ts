import type { GuideContent } from "@/lib/guides/types";

export const API_KEY_MANAGEMENT_GUIDE: GuideContent = {
  title: "API key management: rotate, scope, and revoke",
  subtitle:
    "Best practices for managing FluxyChat API keys: project-scoped keys, rotation, and emergency revocation.",
  sections: [
    {
      id: "overview",
      title: "How API keys work",
      paragraphs: [
        "FluxyChat issues project-scoped API keys (prefixed with fc_) that authenticate REST and WebSocket access. Each key is tied to a specific project and inherits the project's permissions.",
        "Keys are stored hashed in D1 using API_KEY_HASH_SALT. The raw key is only visible at creation time.",
      ],
    },
    {
      id: "rotation",
      title: "Rotating API keys",
      bullets: [
        "Generate a new key via POST /projects/api-keys before removing the old one",
        "Update your application to use the new key",
        "Verify all services work with the new key",
        "Delete the old key via DELETE /projects/api-keys/:id",
        "Never have zero active keys. Overlap during rotation.",
      ],
    },
    {
      id: "scoping",
      title: "Key scoping",
      paragraphs: [
        "Each project has its own set of API keys. In multi-tenant deployments (HOSTED_MULTI_TENANT=true), tenant projects cannot use worker-level keys. They must use their own project-scoped credentials.",
        "Use ALLOW_WORKER_LLM_FALLBACK=true to let all projects use the worker's shared AI credentials as a fallback.",
      ],
    },
    {
      id: "revocation",
      title: "Emergency revocation",
      paragraphs: [
        "To immediately revoke access, delete the API key from the dashboard or via DELETE /projects/api-keys/:id. All active sessions using that key will be disconnected on the next WebSocket heartbeat.",
        "For project-wide revocation, rotate the project's jwt_secret. All existing JWTs become invalid immediately.",
      ],
    },
  ],
  seoTopics: ["api key", "rotation", "revocation", "security", "access control"],
};
