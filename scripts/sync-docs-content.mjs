#!/usr/bin/env node
/**
 * Sync repo documentation → apps/docs/content/docs (Fumadocs site).
 * Sources: docs tree, packages READMEs, dashboard marketing/security guides.
 * Excludes: docs/research/**, PORTAL-* files, Portal competitor references.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "docs");
const DEST = path.join(ROOT, "apps/docs/content/docs");
const PACKAGES = path.join(ROOT, "packages");
const DASHBOARD_GUIDES = path.join(ROOT, "apps/dashboard/lib/guides");

const EXCLUDE_DIR_NAMES = new Set([
  "research",
  "node_modules",
  ".git",
  // Internal-only — GTM, outreach, sales copy (stay in repo docs/, not public site)
  "marketing",
  "distribution",
  "release",
]);

/** Root or nested paths excluded from the public docs site. */
const EXCLUDE_INTERNAL_FILES = new Set([
  "launch-hn.md",
  "m6-pilot-gtm-playbook.md",
  "m6-operational-checklist.md",
  "distribution-playbook.md",
  "product-landing-snippet.md",
  "full-review-m6.md",
  "sendbird-desk-vs-admin.md",
  "competitive-parity-p10.md",
  "PUBLISHING.md",
  "RELEASE-QA-CHECKLIST.md",
  "billing-stripe-runbook.md",
  "README.md",
  "security-review-m6.md",
  "performance-benchmark.md",
  "contract-policy.md",
  "spec-implementation-map.md",
  "supergroup-room-sharding.md",
  "twilio-parity-inspiration.md",
]);

const EXCLUDE_FILE_RE =
  /(?:^|[/\\])(?:PORTAL|portal-sdk)[^/\\]*\.md$/i;

const PROTECTED_REL = new Set([
  "index.mdx",
  "meta.json",
  "quickstart.mdx",
  "client-setup.mdx",
  "guides/self-host.mdx",
  "guides/degraded-http.mdx",
  "guides/broadcast-campaigns.mdx",
  "guides/durable-ai-sessions.mdx",
  "core/inbox.mdx",
  "core/notifications.mdx",
  "core/voice-huddles.mdx",
  "core/meta.json",
  "react/meta.json",
  "guides/meta.json",
  "guides/troubleshooting-integration.mdx",
  "guides/testing-integration.mdx",
  "guides/auth-jwt.mdx",
  "guides/chat/interactive-cards.mdx",
  "guides/chat/inbox-notifications.mdx",
  "guides/ai-agents/handoff.mdx",
  "guides/migrate-from-pusher.mdx",
  "guides/ecosystem/react-native-quickstart.mdx",
  "guides/ecosystem/kotlin-swift-quickstart.mdx",
  "guides/ecosystem/contributing.mdx",
  "guides/advanced/devtools-inspector.mdx",
  "guides/ai-agents/tool-approval-hmac.mdx",
  "guides/ai-agents/agent-memory.mdx",
  "guides/ai-agents/agent-lifecycle.mdx",
  "guides/self-host-one-command.mdx",
  "guides/fluxy-config.mdx",
  "guides/ecosystem/sms-whatsapp-production.mdx",
  "guides/enterprise/dlp-audit-export.mdx",
  "guides/enterprise/soc2-hipaa-runbook.mdx",
  "guides/enterprise/ediscovery.mdx",
  "guides/enterprise/terraform-iac.mdx",
  "guides/enterprise/dlp-cmk-policy.mdx",
  "guides/enterprise/mcp-identity.mdx",
  "guides/knowledge-base-connectors.mdx",
  "guides/slack-discord-bridge.mdx",
  "guides/matrix-bridge.mdx",
  "guides/customer-data-segments.mdx",
  "guides/mcp-apps-marketplace.mdx",
  "guides/enterprise/crm-helpdesk.mdx",
  "guides/enterprise/ai-governance.mdx",
  "guides/automations.mdx",
  "guides/voice-ai-pipeline.mdx",
  "guides/huddles-webrtc.mdx",
  "guides/cross-channel-identity.mdx",
  "cookbook/room-to-ai-messages.mdx",
  "webhooks/meta.json",
  "webhooks/catalog.mdx",
  "platform/meta.json",
  "platform/agent-platform.mdx",
  "platform/realtime-modules.mdx",
]);

/** Hand-authored SDK + platform pages (not overwritten). */
const PROTECTED_PREFIXES = ["core/", "react/", "platform/"];

const PACKAGE_READMES = [
  "sdk",
  "react",
  "protocol",
  "agent",
  "ui",
  "config",
  "create-fluxy-chat",
  "flutter-sdk",
  "react-native-sdk",
];

const GUIDE_SLUG_OVERRIDES = {
  "agent-events-same-stream": "agent-events-same-websocket-stream",
};

function shouldSkipDir(name) {
  return EXCLUDE_DIR_NAMES.has(name);
}

function shouldSkipFile(relFromDocs) {
  const norm = relFromDocs.replace(/\\/g, "/");
  const base = path.basename(relFromDocs);
  if (base.startsWith(".")) return true;
  if (!base.endsWith(".md")) return true;
  if (EXCLUDE_FILE_RE.test(norm)) return true;
  if (EXCLUDE_INTERNAL_FILES.has(base)) return true;
  if (/^guides\/category-[a-h]\.md$/i.test(norm)) return true;
  return false;
}

function sanitizePortalReferences(content) {
  let out = content;
  out = out.replace(/^##\s+vs Portal[\s\S]*?(?=^##\s|\Z)/gim, "");
  out = out.replace(/^##\s+Portal[\s\S]*?(?=^##\s|\Z)/gim, "");
  out = out.replace(/Portal-style ergonomics[^\n]*\n/gi, "");
  out = out.replace(/\[Portal\]\([^)]+\)[^\n]*\n/gi, "");
  out = out.replace(/\buseportal\.co\b/gi, "fluxychat.com");
  out = out.replace(/@portalsdk\/[^\s)]+/g, "@fluxy-chat/sdk");
  out = out.replace(/docs\/research\/[^\s)]+/g, "/docs");
  return out.replace(/\n{3,}/g, "\n\n");
}

function sanitizeForMdx(content) {
  let out = sanitizePortalReferences(content);
  out = out.replace(/```env\n/g, "```bash\n");
  out = out.replace(/!\[Socket Badge\][^\n]*\n/g, "");

  const lines = out.split("\n");
  let inFence = false;
  let fence = "";
  const result = [];

  for (const line of lines) {
    const fenceOpen = line.match(/^(`{3,}|~{3,})/);
    if (fenceOpen) {
      if (!inFence) {
        inFence = true;
        fence = fenceOpen[1];
      } else if (line.startsWith(fence)) {
        inFence = false;
        fence = "";
      }
      result.push(line);
      continue;
    }

    if (inFence) {
      result.push(escapeTextDirectivesInCode(line));
      continue;
    }

    result.push(escapeMdxInProse(line));
  }

  return result.join("\n");
}

/** Escape `:param` patterns that remark parses as textDirective (REST paths, room names, etc.). */
function escapeTextDirectives(text) {
  const parts = text.split(/(`[^`]*`)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part
        .replace(/\b(\d+):(\d+)\b/g, "$1\\:$2")
        .replace(/(\/[a-zA-Z0-9_./-]*):([a-zA-Z][a-zA-Z0-9_-]*)/g, "$1\\:$2")
        .replace(/(?<![:/])([a-zA-Z0-9_-]):([a-zA-Z][a-zA-Z0-9_-]*)/g, "$1\\:$2");
    })
    .join("");
}

function escapeTextDirectivesInCode(line) {
  return line
    .replace(/\b(\d+):(\d+)\b/g, "$1\\:$2")
    .replace(/(\/[a-zA-Z0-9_./-]*):([a-zA-Z][a-zA-Z0-9_-]*)/g, "$1\\:$2")
    .replace(/"([^"\\]*):([a-zA-Z][a-zA-Z0-9_-]*)([^"\\]*)"/g, '"$1\\:$2$3"');
}

function escapeMdxInProse(line) {
  if (line.startsWith("---")) return line;

  let out = line;
  out = out.replace(/\$\{/g, "\\${");
  out = out.replace(/<(\d[\d.,]*)/g, "&lt;$1");
  out = out.replace(/<([^>\n]+?)>/g, (match, inner) => {
    const trimmed = inner.trim();
    if (!trimmed || trimmed.startsWith("/")) return match;
    if (trimmed.includes(" ")) return match;
    return `&lt;${trimmed}&gt;`;
  });
  // Plain markdown sources — escape braces so MDX does not evaluate JS expressions
  out = out.replace(/(?<!\\)\{/g, "\\{");
  out = out.replace(/(?<!\\)\}/g, "\\}");
  out = escapeTextDirectives(out);
  return out;
}

function titleFromMarkdown(body, fallback) {
  const match = body.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return fallback
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function descriptionFromBody(body) {
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("```")) break;
    if (t.startsWith("[") && t.includes("](")) continue;
    if (t.startsWith("|")) continue;
    return t.slice(0, 160);
  }
  return undefined;
}

function fixInternalLinks(content) {
  return content
    .replace(/\]\(\.\/([^)]+\.md)\)/g, "](/docs/$1)")
    .replace(/\]\(\.\.\/([^)]+\.md)\)/g, (_, p) => {
      const slug = p.replace(/\.md$/, "").replace(/\\/g, "/");
      return `](/docs/${slug})`;
    })
    .replace(/\]\(\.\/([^)]+)\)/g, "](/docs/$1)")
    .replace(/\.md\)/g, ")");
}

function toMdx(relPath, mdBody, opts = {}) {
  const slug = relPath.replace(/\.md$/, "").replace(/\\/g, "/");
  const name = path.basename(slug);
  const body = sanitizeForMdx(fixInternalLinks(mdBody));
  const title = opts.title ?? titleFromMarkdown(body, name);
  const description =
    opts.description ?? descriptionFromBody(body) ?? `FluxyChat — ${title}`;

  return `---
title: ${JSON.stringify(escapeTextDirectives(title))}
description: ${JSON.stringify(escapeTextDirectives(description))}
---

${body}`;
}

function walkMdFiles(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walkMdFiles(path.join(dir, entry.name), base, out);
      continue;
    }
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs);
    if (shouldSkipFile(rel)) continue;
    out.push({ abs, rel });
  }
  return out;
}

function isProtected(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (PROTECTED_REL.has(norm)) return true;
  return PROTECTED_PREFIXES.some((p) => norm.startsWith(p));
}

function clearSyncedContent(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(DEST, abs).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      clearSyncedContent(abs);
      const remaining = fs.readdirSync(abs);
      if (remaining.length === 0) fs.rmdirSync(abs);
      continue;
    }
    if (isProtected(rel)) continue;
    if (rel.endsWith(".mdx") || rel.endsWith(".md")) fs.unlinkSync(abs);
  }
}

function writeFile(relDir, slug, content) {
  const destDir = relDir ? path.join(DEST, relDir) : DEST;
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${slug}.mdx`), content, "utf8");
}

function registerPage(byDir, dirRel, slug) {
  const key = dirRel === "." ? "" : dirRel;
  if (!byDir.has(key)) byDir.set(key, []);
  if (!byDir.get(key).includes(slug)) byDir.get(key).push(slug);
}

function writeMetaForDir(dirRel, slugs) {
  if (slugs.length === 0) return;
  const metaPath = path.join(DEST, dirRel, "meta.json");
  const metaRel = dirRel ? `${dirRel}/meta.json` : "meta.json";
  if (isProtected(metaRel)) return;
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  const pages = slugs.slice().sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(metaPath, `${JSON.stringify({ pages }, null, 2)}\n`, "utf8");
}

const SECTION_EMOJI = {
  Start: "🚀",
  "Core SDK": "⚡",
  React: "⚛️",
  Packages: "📦",
  Platform: "🌐",
  Features: "✨",
  Cookbooks: "🍳",
  "Use cases": "💡",
  Guides: "📖",
  Learn: "🎓",
  Operations: "🛠️",
  Architecture: "🏗️",
  Security: "🔒",
  Snippets: "📝",
  Reference: "📚",
};

function sectionTitle(title) {
  const emoji = SECTION_EMOJI[title];
  return emoji ? `${emoji} ${title}` : title;
}

function unescapeString(s) {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractStringField(src, field) {
  const re = new RegExp(`${field}:\\s*"((?:\\\\.|[^"\\\\])*)"`, "s");
  const m = src.match(re);
  return m ? unescapeString(m[1]) : undefined;
}

function extractTemplateField(src, field) {
  const marker = `${field}:`;
  const idx = src.indexOf(marker);
  if (idx === -1) return undefined;
  let i = idx + marker.length;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== "`") return undefined;
  const tick = src[i];
  i++;
  let body = "";
  while (i < src.length) {
    if (src[i] === "\\") {
      body += src[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (src[i] === tick) break;
    body += src[i];
    i++;
  }
  return body;
}

function extractStringArray(src, field) {
  const re = new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`, "s");
  const m = src.match(re);
  if (!m) return [];
  const inner = m[1];
  const items = [];
  const strRe = /"((?:\\.|[^"\\])*)"/g;
  let sm;
  while ((sm = strRe.exec(inner))) items.push(unescapeString(sm[1]));
  return items;
}

function extractTopLevelField(src, field) {
  const objStart = src.indexOf("{");
  const sectionsIdx = src.indexOf("sections:");
  const scope =
    objStart === -1
      ? src
      : sectionsIdx === -1
        ? src.slice(objStart)
        : src.slice(objStart, sectionsIdx);
  return extractStringField(scope, field);
}

function extractSections(src) {
  const start = src.indexOf("sections:");
  if (start === -1) return [];
  const arrStart = src.indexOf("[", start);
  if (arrStart === -1) return [];

  const sections = [];
  let i = arrStart + 1;

  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === "]") break;
    if (src[i] === ",") {
      i++;
      continue;
    }
    if (src[i] !== "{") {
      i++;
      continue;
    }

    const objStart = i;
    let depth = 0;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const block = src.slice(objStart, i + 1);
          sections.push({
            title: extractStringField(block, "title"),
            paragraphs: extractStringArray(block, "paragraphs"),
            bullets: extractStringArray(block, "bullets"),
            code: extractTemplateField(block, "code"),
          });
          i++;
          break;
        }
      }
    }
  }

  return sections.filter((s) => s.title);
}

function guideToMarkdown(title, subtitle, sections) {
  const lines = [`# ${title}`, "", subtitle, ""];
  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const p of section.paragraphs ?? []) {
      lines.push(escapeMdxInProse(p), "");
    }
    for (const b of section.bullets ?? []) {
      lines.push(`- ${escapeMdxInProse(b)}`);
    }
    if ((section.bullets ?? []).length) lines.push("");
    if (section.code) {
      lines.push("```", section.code, "```", "");
    }
  }
  return lines.join("\n").trim() + "\n";
}

function syncDashboardGuides(byDir) {
  if (!fs.existsSync(DASHBOARD_GUIDES)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(DASHBOARD_GUIDES)) {
    if (!entry.endsWith(".ts")) continue;
    if (entry === "types.ts" || entry === "related-guides.ts") continue;
    const base = entry.replace(/\.ts$/, "");
    const slug = GUIDE_SLUG_OVERRIDES[base] ?? base;
    const src = fs.readFileSync(path.join(DASHBOARD_GUIDES, entry), "utf8");
    const title = extractTopLevelField(src, "title");
    const subtitle = extractTopLevelField(src, "subtitle");
    const sections = extractSections(src);
    if (!title || sections.length === 0) continue;

    const md = guideToMarkdown(title, subtitle ?? title, sections);
    writeFile(
      "learn",
      slug,
      toMdx(`learn/${slug}.md`, md, { title, description: subtitle }),
    );
    registerPage(byDir, "learn", slug);
    count++;
  }
  return count;
}

function syncPackageReadmes(byDir) {
  let count = 0;
  for (const pkg of PACKAGE_READMES) {
    const candidates = [
      path.join(PACKAGES, pkg, "README.md"),
      path.join(PACKAGES, pkg, "readme.md"),
    ];
    const readme = candidates.find((p) => fs.existsSync(p));
    if (!readme) continue;
    const md = fs.readFileSync(readme, "utf8");
    writeFile("packages", pkg, toMdx(`packages/${pkg}.md`, md));
    registerPage(byDir, "packages", pkg);
    count++;
  }
  return count;
}

function buildRootMeta(byDir) {
  const orderedSections = [
    { title: "Start", pages: ["index", "quickstart", "client-setup", "quickstart-afternoon"] },
    { title: "Core SDK", folder: "core" },
    { title: "React", folder: "react" },
    { title: "Packages", folder: "packages" },
    { title: "Platform", folder: "platform" },
    { title: "Features", files: ["features-overview", "fluxystream"] },
    { title: "Cookbooks", folder: "cookbook" },
    { title: "Use cases", folder: "use-cases" },
    { title: "Guides", folder: "guides" },
    { title: "Learn", folder: "learn" },
    {
      title: "Operations",
      folder: "operations",
      exclude: new Set(["d1-schema-consolidation"]),
    },
    { title: "Architecture", folder: "architecture" },
    { title: "Security", folders: ["security", "audit"] },
    { title: "Snippets", folder: "snippets" },
    {
      title: "Reference",
      files: [
        "self-hosting",
        "local-development",
        "dashboard-integration",
        "hosted-domains",
        "troubleshooting",
        "pusher-channels-parity",
        "web-push-vapid",
        "embed-widget",
        "ai-gateway",
        "message-middleware",
      ],
    },
  ];

  const pages = [];
  const seen = new Set();

  function add(page) {
    if (seen.has(page)) return;
    seen.add(page);
    pages.push(page);
  }

  for (const section of orderedSections) {
    pages.push(`---${sectionTitle(section.title)}---`);
    if (section.pages) {
      for (const p of section.pages) add(p);
    }
    if (section.files) {
      for (const f of section.files) add(f);
    }
    if (section.folder) {
      pages.push(section.folder);
      const skip = section.exclude ?? new Set();
      for (const slug of byDir.get(section.folder) ?? []) {
        if (skip.has(slug)) continue;
        seen.add(`${section.folder}/${slug}`);
      }
      continue;
    }
    if (section.dir) {
      pages.push(section.dir);
      const skip = section.exclude ?? new Set();
      for (const slug of byDir.get(section.dir) ?? []) {
        if (skip.has(slug)) continue;
        seen.add(`${section.dir}/${slug}`);
      }
      continue;
    }
    if (section.folders) {
      for (const dir of section.folders) {
        pages.push(dir);
        for (const slug of byDir.get(dir) ?? []) seen.add(`${dir}/${slug}`);
      }
      continue;
    }
  }

  // Root-level docs not yet listed
  for (const slug of byDir.get("") ?? []) {
    if (slug !== "index") add(slug);
  }

  // Any remaining directories
  for (const [dir, slugs] of byDir) {
    if (!dir || orderedSections.some((s) => s.folder === dir || s.folders?.includes(dir)))
      continue;
    pages.push(`---${dir}---`);
    for (const slug of slugs) add(`${dir}/${slug}`);
  }

  fs.writeFileSync(
    path.join(DEST, "meta.json"),
    `${JSON.stringify({ title: "Documentation", pages }, null, 2)}\n`,
    "utf8",
  );
}

function main() {
  fs.mkdirSync(DEST, { recursive: true });
  clearSyncedContent(DEST);

  const byDir = new Map();
  const files = walkMdFiles(SRC);

  for (const { abs, rel } of files) {
    const dirRel = path.dirname(rel).replace(/\\/g, "/");
    const slug = path.basename(rel, ".md");
    const md = fs.readFileSync(abs, "utf8");
    const normalizedDir = dirRel === "." ? "" : dirRel;
    writeFile(normalizedDir, slug, toMdx(rel, md));
    registerPage(byDir, normalizedDir, slug);
  }

  const pkgCount = syncPackageReadmes(byDir);
  const guideCount = syncDashboardGuides(byDir);

  for (const [dirRel, slugs] of byDir) {
    if (!dirRel) continue;
    writeMetaForDir(dirRel, slugs);
  }

  buildRootMeta(byDir);

  console.log(
    `sync-docs-content: ${files.length} docs + ${pkgCount} packages + ${guideCount} learn guides → ${DEST}`,
  );
}

main();
