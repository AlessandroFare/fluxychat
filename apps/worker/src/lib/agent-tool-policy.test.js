import { describe, expect, it, vi } from "vitest";
import {
  evaluateToolPolicyDocument,
  toolNameMatches,
  normalizePolicyDocument,
  resolveOnHoldPhrase,
} from "./agent-tool-policy.js";

describe("agent-tool-policy", () => {
  it("matches wildcard tool names", () => {
    expect(toolNameMatches("delete_*", "delete_file")).toBe(true);
    expect(toolNameMatches("delete_*", "read_file")).toBe(false);
  });

  it("requires approval for high-risk tools", () => {
    const policy = normalizePolicyDocument({
      defaultEffect: "allow",
      rules: [
        {
          id: "approve-send",
          tools: ["sendMessage"],
          effect: "require_approval",
          priority: 10,
        },
      ],
    });
    const decision = evaluateToolPolicyDocument(policy, {
      toolName: "sendMessage",
      input: { roomId: "r1" },
      context: {},
    });
    expect(decision.requiresApproval).toBe(true);
    expect(decision.allowed).toBe(true);
  });

  it("denies destructive tools", () => {
    const policy = normalizePolicyDocument({
      rules: [{ id: "deny-del", tools: ["delete_*"], effect: "deny", priority: 20 }],
    });
    const decision = evaluateToolPolicyDocument(policy, {
      toolName: "delete_room",
      input: {},
      context: {},
    });
    expect(decision.denied).toBe(true);
    expect(decision.allowed).toBe(false);
  });

  it("NW-200 resolves onHoldPhrase from matched rule", () => {
    const policy = normalizePolicyDocument({
      rules: [
        {
          id: "hold-search",
          tools: ["web_search", "search_*"],
          effect: "allow",
          onHoldPhrase: "Searching the knowledge base…",
          priority: 5,
        },
      ],
    });
    const decision = evaluateToolPolicyDocument(policy, {
      toolName: "web_search",
      input: {},
      context: {},
    });
    expect(decision.onHoldPhrase).toBe("Searching the knowledge base…");
    expect(resolveOnHoldPhrase(policy, "web_search")).toBe("Searching the knowledge base…");
    expect(resolveOnHoldPhrase(policy, "other_tool")).toBe("One moment — I'm looking that up.");
  });
});
