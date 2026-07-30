#!/usr/bin/env node
/**
 * Build static status page for Cloudflare Pages.
 * Reads content/status-incidents.md and bakes HTML at build time.
 * Runtime health check uses fetch to NEXT_PUBLIC_WORKER_URL/health in browser.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const INCIDENTS = path.join(ROOT, "content/status-incidents.md");
const OUT = path.join(__dirname, "dist");

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseIncidents(markdown) {
  const active = [];
  const resolved = [];
  let section = null;
  let current = null;

  function flush() {
    if (!current) return;
    if (section === "active") active.push(current);
    if (section === "resolved") resolved.push(current);
    current = null;
  }

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (/^##\s+Active/i.test(line)) {
      flush();
      section = "active";
      continue;
    }
    if (/^##\s+Resolved/i.test(line)) {
      flush();
      section = "resolved";
      continue;
    }
    if (!section) continue;
    if (line.startsWith("### ")) {
      flush();
      current = { title: line.slice(4).trim(), lines: [] };
      continue;
    }
    if (current && line) current.lines.push(line);
  }
  flush();
  return { active, resolved };
}

const incidentsMd = fs.existsSync(INCIDENTS) ? fs.readFileSync(INCIDENTS, "utf8") : "";
const { active, resolved } = parseIncidents(incidentsMd);
const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? process.env.WORKER_URL ?? "http://127.0.0.1:8787";
const healthUrl = `${workerUrl.replace(/\/$/, "")}/health`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FluxyChat Status</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    .card { border: 1px solid #e5e7eb; border-radius: 1rem; padding: 1.25rem; margin: 1rem 0; }
    .ok { color: #059669; } .warn { color: #d97706; } .bad { color: #dc2626; }
    h1 { font-size: 1.75rem; } h2 { font-size: 1.125rem; margin: 0 0 0.5rem; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.75rem; }
  </style>
</head>
<body>
  <h1>FluxyChat system status</h1>
  <p>Public health for the chat API. Incidents are sourced from <code>content/status-incidents.md</code>.</p>

  <div class="card">
    <h2>Chat API</h2>
    <p id="status-label">Checking…</p>
    <p class="mono" id="status-endpoint">${escapeHtml(workerUrl)}/health</p>
    <p class="mono" id="status-meta"></p>
  </div>

  <div class="card">
    <h2>Active incidents</h2>
    ${
      active.length === 0
        ? '<p class="ok">No active incidents.</p>'
        : active.map((i) => `<article><strong>${escapeHtml(i.title)}</strong><pre>${escapeHtml(i.lines.join("\\n"))}</pre></article>`).join("")
    }
  </div>

  <div class="card">
    <h2>Resolved</h2>
    ${
      resolved.length === 0
        ? "<p>No resolved incidents published.</p>"
        : resolved
            .slice(0, 8)
            .map((i) => `<article><strong>${escapeHtml(i.title)}</strong><pre>${escapeHtml(i.lines.join("\\n"))}</pre></article>`)
            .join("")
    }
  </div>

  <script>
    const url = ${JSON.stringify(healthUrl)};
    fetch(url).then(async (res) => {
      const data = await res.json().catch(() => null);
      const label = document.getElementById("status-label");
      const meta = document.getElementById("status-meta");
      if (!data) {
        label.textContent = "Major outage";
        label.className = "bad";
        return;
      }
      const text = !data.ok ? "Major outage" : data.degraded ? "Degraded" : "Operational";
      label.textContent = text;
      label.className = !data.ok ? "bad" : data.degraded ? "warn" : "ok";
      meta.textContent = [data.version && "v" + data.version, data.ts && new Date(data.ts).toISOString()].filter(Boolean).join(" · ");
    }).catch(() => {
      document.getElementById("status-label").textContent = "Unreachable";
      document.getElementById("status-label").className = "bad";
    });
  </script>
</body>
</html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), html, "utf8");
console.log("Built apps/status/dist/index.html");
