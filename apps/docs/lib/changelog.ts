import fs from "node:fs";
import path from "node:path";

export interface ChangelogRelease {
  packageName: string;
  version: string;
  date?: string;
  sections: Array<{ heading: string; items: string[] }>;
}

const ROOT = path.resolve(process.cwd(), "../..");

const CHANGELOG_SOURCES: Array<{ packageName: string; relPath: string }> = [
  { packageName: "@fluxy-chat/sdk", relPath: "packages/sdk/CHANGELOG.md" },
  { packageName: "@fluxy-chat/flutter-sdk", relPath: "packages/flutter-sdk/CHANGELOG.md" },
];

function parseChangelogMarkdown(content: string, packageName: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  const blocks = content.split(/^## /m).slice(1);

  for (const block of blocks) {
    const [headerLine, ...rest] = block.split("\n");
    const headerMatch = headerLine.match(/^(.+?)(?:\s+\(([^)]+)\))?$/);
    if (!headerMatch) continue;

    const version = headerMatch[1].trim();
    const date = headerMatch[2]?.trim();
    const body = rest.join("\n");
    const sections: ChangelogRelease["sections"] = [];
    const sectionBlocks = body.split(/^### /m).slice(1);

    for (const sectionBlock of sectionBlocks) {
      const [sectionHeading, ...sectionLines] = sectionBlock.split("\n");
      const items = sectionLines
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim());

      if (items.length > 0) {
        sections.push({ heading: sectionHeading.trim(), items });
      }
    }

    releases.push({ packageName, version, date, sections });
  }

  return releases;
}

export function loadChangelogReleases(): ChangelogRelease[] {
  const all: ChangelogRelease[] = [];

  for (const source of CHANGELOG_SOURCES) {
    const abs = path.join(ROOT, source.relPath);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, "utf8");
    all.push(...parseChangelogMarkdown(content, source.packageName));
  }

  return all.sort((a, b) => {
    const dateA = a.date ? Date.parse(a.date) : 0;
    const dateB = b.date ? Date.parse(b.date) : 0;
    return dateB - dateA;
  });
}
