import { describe, it, expect } from "vitest";
import { BUILT_IN_COMMANDS } from "./room-commands.js";
import {
  composeAgentSystemPrompt,
  isProductGuideAgent,
  formatBuiltInSlashCatalog,
} from "./fluxychat-product-knowledge.js";

describe("fluxychat product knowledge", () => {
  it("treats @assistant as a product guide", () => {
    expect(isProductGuideAgent({ handle: "@assistant", id: "x" })).toBe(true);
    expect(isProductGuideAgent({ handle: "support", id: "custom-1" })).toBe(false);
    expect(isProductGuideAgent({ id: "builtin-assistant-proj1", handle: null })).toBe(true);
  });

  it("injects only real built-in slash commands", () => {
    const prompt = composeAgentSystemPrompt({
      tenantPrompt: "Be helpful",
      agentRow: { id: "custom", handle: "helper" },
    });
    expect(prompt).toContain("/help");
    expect(prompt).toContain("/poll");
    expect(prompt).toContain("/clear");
    expect(prompt).toContain("no /giphy");
    expect(prompt).toContain("Never suggest a slash command that is not in this catalog");
    for (const cmd of BUILT_IN_COMMANDS) {
      expect(formatBuiltInSlashCatalog()).toContain(cmd.command);
    }
  });

  it("adds product brief only for guide agents", () => {
    const guide = composeAgentSystemPrompt({
      tenantPrompt: "Hi",
      agentRow: { handle: "@assistant", id: "builtin-assistant-p" },
    });
    const other = composeAgentSystemPrompt({
      tenantPrompt: "Hi",
      agentRow: { handle: "@billing", id: "bot-billing" },
      customCommands: [{ command: "/standup", description: "Post standup", usage: "/standup" }],
    });
    expect(guide).toContain("@fluxy-chat/sdk");
    expect(other).not.toContain("@fluxy-chat/sdk");
    expect(other).toContain("/help");
    expect(other).toContain("/standup");
  });
});
