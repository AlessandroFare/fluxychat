# Security notes

| Topic | Doc |
|-------|-----|
| Agent `tool_execute_url` and tenant-admin trust | [agent-tool-exfiltration.md](./agent-tool-exfiltration.md) |
| Full M6 security review | [security-review-m6.md](../security-review-m6.md) |

SSRF outbound policy: `apps/worker/src/lib/url-ssrf.ts` (`assertSafeOutboundUrl`).
