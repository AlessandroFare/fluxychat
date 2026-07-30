import fs from "node:fs";
import path from "node:path";

export interface StatusIncident {
  title: string;
  date?: string;
  status?: string;
  impact?: string;
  duration?: string;
  summary?: string;
  active: boolean;
}

const INCIDENTS_PATH = path.resolve(process.cwd(), "../../content/status-incidents.md");

function parseField(line: string, label: string): string | undefined {
  const match = line.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, "i"));
  return match?.[1]?.trim();
}

export function loadStatusIncidents(): { active: StatusIncident[]; resolved: StatusIncident[] } {
  if (!fs.existsSync(INCIDENTS_PATH)) {
    return { active: [], resolved: [] };
  }

  const content = fs.readFileSync(INCIDENTS_PATH, "utf8");
  const active: StatusIncident[] = [];
  const resolved: StatusIncident[] = [];
  let section: "active" | "resolved" | null = null;

  const lines = content.split("\n");
  let current: StatusIncident | null = null;

  function flush() {
    if (!current) return;
    if (section === "active") active.push(current);
    if (section === "resolved") resolved.push(current);
    current = null;
  }

  for (const raw of lines) {
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
      const title = line.slice(4).trim();
      const dateMatch = title.match(/^(\d{4}-\d{2}-\d{2})\s+—\s+(.+)$/);
      current = {
        title: dateMatch?.[2] ?? title,
        date: dateMatch?.[1],
        active: section === "active",
      };
      continue;
    }

    if (!current) {
      if (line.startsWith("_") && line.endsWith("_")) {
        continue;
      }
      if (section === "active" && line.length > 0 && !line.startsWith("#")) {
        current = { title: line, active: true };
      }
      continue;
    }

    const status = parseField(line, "Status");
    const impact = parseField(line, "Impact");
    const duration = parseField(line, "Duration");
    const summary = parseField(line, "Summary");
    if (status) current.status = status;
    if (impact) current.impact = impact;
    if (duration) current.duration = duration;
    if (summary) current.summary = summary;
  }

  flush();
  return { active, resolved };
}
