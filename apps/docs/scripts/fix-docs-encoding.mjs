import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../content/docs");

const MERMAID = `## 10. Architecture Quick Reference

\`\`\`mermaid
flowchart TB
  subgraph dashboard["apps/dashboard — Next.js :3000"]
    landing["/landing"]
    onboarding["/onboarding"]
    console["/rooms · /agents · /admin"]
    landing --> onboarding
    onboarding --> console
  end

  subgraph worker["apps/worker — Cloudflare Worker :8787"]
    rest["REST API"]
    ws["WebSocket"]
    do["Durable Objects\\n(Room, User, RateLimit)"]
    d1["D1 · KV · R2"]
    rest --> do
    ws --> do
    do --> d1
  end

  subgraph agent["apps/ai-agent — Worker :8788"]
    llm["Mention webhooks → LLM → replies"]
  end

  console -->|"REST + WebSocket"| worker
  worker -->|"webhooks"| agent
\`\`\``;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".mdx")) out.push(p);
  }
  return out;
}

/** Box-drawing UTF-8 misread as Windows-1252 (â + punctuation) */
const BOX_MOJIBAKE = /\u00e2[\u201d\u201c\u2020][\u0152\u201a\u201d\u201c\u0080-\u00bf]/;

const MOJIBAKE = [
  ["\u00e2\u2020\u2019", "\u2192"],
  ["\u00e2\u2020\u2018", "\u2190"],
  ["\u00e2\u2020\u0090", "\u2190"],
  ["\u00e2\u2020\u201c", "\u2193"],
  ["\u00e2\u20ac\u201d", "\u2014"],
  ["\u00e2\u20ac\u201c", "\u2013"],
  ["\u00e2\u20ac\u2122", "'"],
  ["\u00e2\u20ac\u0153", "\u201c"],
  ["\u00e2\u20ac\u009d", "\u201d"],
  ["\u00e2\u20ac\u00a6", "\u2026"],
  ["\u00c2\u00a7", "\u00a7"],
  ["\u00e2\u2013\u00b2", "\u25b2"],
  ["\u00e2\u20ac\u0098", "'"],
  ["\u00e2\u20ac\u0099", "'"],
  ["\u00c2\u00b0", "\u00b0"],
  ["\u00c2\u00ab", "\u00ab"],
  ["\u00c2\u00bb", "\u00bb"],
];

function fixMojibake(text) {
  let out = text;
  for (const [bad, good] of MOJIBAKE) out = out.split(bad).join(good);
  return out;
}

function stripBoldInDescription(text) {
  return text.replace(
    /^description:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*$/gm,
    (line) => line.replace(/\*\*/g, ""),
  );
}

function fixFile(filePath) {
  const before = fs.readFileSync(filePath, "utf8");
  let after = fixMojibake(before);
  after = stripBoldInDescription(after);

  if (BOX_MOJIBAKE.test(after) || after.includes("\u00e2\u201d\u0152")) {
    after = after.replace(
      /## 10\. Architecture Quick Reference\r?\n\r?\n```[\s\S]*?```/,
      MERMAID,
    );
  }

  // Remove any fenced code block that is mostly box-drawing mojibake
  after = after.replace(/```\r?\n([\s\S]*?)```/g, (block, inner) => {
    const badLines = inner.split("\n").filter((l) => BOX_MOJIBAKE.test(l) || /^â/.test(l));
    if (badLines.length >= 3) return "";
    return block;
  });

  if (after !== before) {
    fs.writeFileSync(filePath, after, "utf8");
    return true;
  }
  return false;
}

let changed = 0;
const suspects = [];

for (const file of walk(docsRoot)) {
  if (fixFile(file)) {
    changed++;
    console.log("fixed:", path.relative(docsRoot, file));
  }
  const text = fs.readFileSync(file, "utf8");
  const hits = [...text.matchAll(/\u00e2[\u0080-\u00bf\u201d\u201c]|\u00c2[\u0080-\u00bf]|(?<![A-Za-z])Â(?![A-Za-z])/g)];
  if (hits.length) suspects.push({ file: path.relative(docsRoot, file), n: hits.length });
}

console.log(`\nUpdated ${changed} file(s).`);
if (suspects.length) {
  console.log("Remaining suspects:");
  for (const s of suspects) console.log(`  ${s.file}: ${s.n}`);
} else console.log("No mojibake suspects remain.");
