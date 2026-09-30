import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("MCP server.json", () => {
  it("names the remote Streamable HTTP server", () => {
    const raw = JSON.parse(readFileSync(join(root, "server.json"), "utf8"));
    expect(raw.name).toBe("io.github.alessandrofare/fluxychat");
    expect(raw.remotes[0].type).toBe("streamable-http");
    expect(String(raw.remotes[0].url)).toContain("/mcp");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.mcpName).toBe(raw.name);
  });
});
