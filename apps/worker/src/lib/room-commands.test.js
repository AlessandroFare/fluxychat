import { describe, it, expect, vi } from "vitest";
import { parseCommand, listCommands, getAutocompleteSuggestions, executeCommand } from "../lib/room-commands.js";

function makeEnv(overrides = {}) {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    },
    ...overrides,
  };
}

describe("room-commands", () => {
  describe("parseCommand", () => {
    it("returns null for non-command text", () => {
      expect(parseCommand("hello world")).toBeNull();
      expect(parseCommand("")).toBeNull();
      expect(parseCommand(null)).toBeNull();
    });

    it("parses simple command", () => {
      const result = parseCommand("/help");
      expect(result).toEqual({ command: "/help", args: [], rawArgs: "" });
    });

    it("parses command with args", () => {
      const result = parseCommand("/mute @john spamming");
      expect(result.command).toBe("/mute");
      expect(result.args).toEqual(["@john", "spamming"]);
      expect(result.rawArgs).toBe("@john spamming");
    });

    it("normalizes command to lowercase", () => {
      const result = parseCommand("/HELP");
      expect(result.command).toBe("/help");
    });
  });

  describe("listCommands", () => {
    it("returns built-in commands", async () => {
      const env = makeEnv();
      const commands = await listCommands(env, { projectId: "p1" });
      expect(commands.length).toBeGreaterThanOrEqual(12);
      expect(commands.find(c => c.command === "/help")).toBeDefined();
      expect(commands.find(c => c.command === "/mute")).toBeDefined();
      expect(commands.find(c => c.command === "/pin")).toBeDefined();
    });
  });

  describe("getAutocompleteSuggestions", () => {
    it("returns suggestions for partial match", async () => {
      const env = makeEnv();
      const suggestions = await getAutocompleteSuggestions(env, { projectId: "p1", partial: "/mu" });
      expect(suggestions.some(s => s.command === "/mute")).toBe(true);
    });

    it("returns suggestions for description match", async () => {
      const env = makeEnv();
      const suggestions = await getAutocompleteSuggestions(env, { projectId: "p1", partial: "escalate" });
      expect(suggestions.some(s => s.command === "/escalate")).toBe(true);
    });

    it("returns empty for no match", async () => {
      const env = makeEnv();
      const suggestions = await getAutocompleteSuggestions(env, { projectId: "p1", partial: "/zzz" });
      expect(suggestions).toEqual([]);
    });
  });

  describe("executeCommand", () => {
    it("returns error for unknown command", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "member", command: "/nonexistent", args: [], rawArgs: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unknown command");
    });

    it("executes /help command", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "member", command: "/help", args: [], rawArgs: "" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("help");
      expect(result.commands).toBeDefined();
    });

    it("returns error for insufficient permissions", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "guest", command: "/mute", args: ["@john"], rawArgs: "@john" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Insufficient permissions");
    });

    it("executes /mute with mod role", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "mod", command: "/mute", args: ["@john", "spamming"], rawArgs: "@john spamming" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("mute");
      expect(result.target).toBe("john");
    });

    it("executes /unmute", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "mod", command: "/unmute", args: ["@john"], rawArgs: "@john" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("unmute");
    });

    it("executes /pin", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "mod", command: "/pin", args: ["msg123"], rawArgs: "msg123" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("pin");
      expect(result.messageId).toBe("msg123");
    });

    it("executes /escalate", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "member", command: "/escalate", args: [], rawArgs: "urgent issue" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("escalate");
    });

    it("executes /summarize with count", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "member", command: "/summarize", args: ["50"], rawArgs: "50" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("summarize");
      expect(result.count).toBe(50);
    });

    it("executes /broadcast with admin role", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "admin", command: "/broadcast", args: [], rawArgs: "server maintenance tonight" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("broadcast");
    });

    it("returns error for /broadcast without message", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "admin", command: "/broadcast", args: [], rawArgs: "" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("message");
    });

    it("executes /export", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "admin", command: "/export", args: ["json"], rawArgs: "json" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("export");
      expect(result.format).toBe("json");
    });

    it("executes /clear", async () => {
      const env = makeEnv();
      const result = await executeCommand(env, { projectId: "p1", roomId: "r1", userId: "u1", userRole: "member", command: "/clear", args: [], rawArgs: "" });
      expect(result.ok).toBe(true);
      expect(result.action).toBe("clear");
    });
  });
});
