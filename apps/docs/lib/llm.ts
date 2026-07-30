import type { source } from "@/lib/source";

type Page = (typeof source)["$inferPage"];

export async function getLLMText(page: Page): Promise<string> {
  if (page.type === "openapi") {
    const lines = [`# ${page.data.title}`, ""];
    if (page.data.description) {
      lines.push(page.data.description, "");
    }
    lines.push(`Source: ${page.url}`);
    return lines.join("\n");
  }

  const processed = await page.data.getText("processed");
  return `# ${page.data.title} (${page.url})\n\n${processed}`;
}
