# Security

Thanks for helping keep FluxyChat safe.

## Reporting a vulnerability

**Please do not file a public issue for security problems.** Email
**fluxychat@outlook.com** with:

- A short description of the issue and its impact
- Reproduction steps (proof-of-concept code, screenshots, or a screen recording)
- The commit / version / deployment URL you saw it on
- Your name and whether you'd like public credit in the fix release notes

We aim to acknowledge new reports within **3 business days** and to
provide a fix or mitigation plan within **14 days** of confirmation. We
follow responsible disclosure: please give us a reasonable window
(typically 90 days, or by coordinated release date) before publishing
details.

If the report is sensitive, request PGP-encrypted reply in your first
email and we will respond with our public key.

## Scope

In scope:

- The Cloudflare Worker at `apps/worker` and the AI Agent Worker at
  `apps/ai-agent`
- The Next.js dashboard at `apps/dashboard`
- The TypeScript SDK at `packages/sdk`
- Authentication, authorization, tenant isolation, JWT / API key
  handling, signing-secret storage, webhook delivery, billing
  integrations, GDPR / privacy, SSRF, XSS, RCE, SQLi, DoS

Out of scope:

- The Cloudflare platform itself
- Third-party services we integrate with (Stripe, Clerk, Sent.dm, etc.)
  — please report to them directly
- Rate-limiting bypasses that require >1,000 RPS from a single IP
  (we have DDoS-layer protection upstream)

## Hardening we have already shipped

See `FLUXYCHAT_FULL_AUDIT.md` (if present in the repo) for the live
audit. Highlights:

- HMAC-SHA-256 with a server-side salt for API key hashing
  (env `API_KEY_HASH_SALT`)
- Webhook signing secrets encrypted at rest (AES-GCM,
  `WEBHOOK_SECRET_ENCRYPTION_KEY`)
- Stripe webhook signatures required (no "skip if no secret" path)
- Stored-XSS sanitization for search snippets and the markdown
  renderer
- SAML signature verification refuses to issue tokens when the
  underlying verifier is not configured
- CORS hardened: identity routes never use wildcard; default
  `ALLOWED_ORIGINS` is empty, operators opt in explicitly

## Bug bounty

We do not currently run a paid bug-bounty programme. We do publicly
credit reporters (with permission) in release notes and on this page.
