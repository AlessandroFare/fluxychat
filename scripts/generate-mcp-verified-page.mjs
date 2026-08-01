#!/usr/bin/env node
/**
 * Generate static MCP verified servers page from examples + local audit JSON artifacts.
 * Usage: node scripts/generate-mcp-verified-page.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DOCS = path.join(ROOT, "apps/docs/content/docs/guides/ecosystem/mcp-verified-servers.mdx");
const OUT_DATA = path.join(ROOT, "apps/dashboard/public/mcp-verified.json");

const SERVERS = [
  { id: "github-mcp", dir: "github", name: "GitHub MCP", vendor: "FluxyChat example" },
  { id: "slack-mcp", dir: "slack", name: "Slack MCP", vendor: "FluxyChat example" },
  { id: "notion-mcp", dir: "notion", name: "Notion MCP", vendor: "FluxyChat example" },
];

function readAudit(serverDir) {
  const auditPath = path.join(ROOT, "examples/mcp", serverDir, "audit.json");
  if (!fs.existsSync(auditPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(auditPath, "utf8"));
  } catch {
    return null;
  }
}

function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

const entries = SERVERS.map((s) => {
  const audit = readAudit(s.dir);
  const score = audit?.score?.value ?? audit?.score ?? null;
  const grade = audit?.score?.grade ?? (score != null ? gradeFromScore(Number(score)) : null);
  const critical = Array.isArray(audit?.findings)
    ? audit.findings.filter((f) => String(f.severity).toLowerCase() === "critical").length
    : 0;
  return {
    ...s,
    score,
    grade,
    critical,
    clonePath: `examples/mcp/${s.dir}`,
    repoUrl: `https://github.com/AlessandroFare/fluxychat/tree/main/examples/mcp/${s.dir}`,
  };
});

fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
fs.writeFileSync(OUT_DATA, JSON.stringify({ generatedAt: new Date().toISOString(), servers: entries }, null, 2));

function cell(value) {
  if (value == null || value === "") return "n/a";
  return String(value);
}

const rows = entries
  .map(
    (e) =>
      `| [${e.name}](${e.repoUrl}) | ${cell(e.grade)} | ${cell(e.score)} | ${e.critical} | \`${e.clonePath}\` |`,
  )
  .join("\n");

const mdx = `---
title: Verified MCP servers
description: Curated MCP examples scanned with mcp-audit with reproducible grades.
---

# Verified MCP servers

Servers in the FluxyChat marketplace catalog with **mcp-audit** scan results. Re-run locally:

\`\`\`bash
cd examples/mcp/github
mcp-audit check --json > audit.json
\`\`\`

CI posts results to D1 when \`WORKER_AUDIT_WEBHOOK_URL\` is configured.

| Server | Grade | Score | Critical | Clone |
|--------|-------|-------|----------|-------|
${rows}

## Audit policy

- **Grade A-B**, 0 critical findings: eligible for Verified badge in console
- Scans run on every push to \`examples/mcp/\`
- Tool: [mcp-audit](https://github.com/adudley78/mcp-audit) (Apache 2.0)

Regenerate this page after CI: \`node scripts/generate-mcp-verified-page.mjs\`
`;

fs.mkdirSync(path.dirname(OUT_DOCS), { recursive: true });
fs.writeFileSync(OUT_DOCS, mdx);
console.log("Wrote", OUT_DOCS);
console.log("Wrote", OUT_DATA);
