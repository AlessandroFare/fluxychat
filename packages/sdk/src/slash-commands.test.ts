import { describe, it, expect, vi } from "vitest";
import { createSlashCommandRegistry, BUILTIN_COMMANDS } from "./slash-commands";
import type { ParsedArgs, CommandContext } from "./slash-commands";

function mockContext(overrides?: Partial<CommandContext>): CommandContext {
  return {
    userId: "user:1",
    roomId: "room:1",
    projectId: "proj:1",
    isAdmin: false,
    reply: vi.fn(),
    ...overrides,
  };
}

describe("createSlashCommandRegistry", () => {
  it("returns null for non-command messages", () => {
    const reg = createSlashCommandRegistry();
    expect(reg.parse("hello world")).toBeNull();
    expect(reg.parse("not/a/command")).toBeNull();
  });

  it("parses /command with no args", () => {
    const reg = createSlashCommandRegistry();
    const result = reg.parse("/help");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("help");
    expect(result!.args.positional).toEqual([]);
  });

  it("parses /command with positional args", () => {
    const reg = createSlashCommandRegistry();
    const result = reg.parse("/kick user123 spam");
    expect(result!.command).toBe("kick");
    expect(result!.args.positional).toEqual(["user123", "spam"]);
  });

  it("parses named args (--key value)", () => {
    const reg = createSlashCommandRegistry();
    const result = reg.parse("/timeout user:1 --duration 10");
    expect(result!.args.named).toEqual({ duration: "10" });
  });

  it("parses flags (--flag)", () => {
    const reg = createSlashCommandRegistry();
    const result = reg.parse("/deploy --force");
    expect([...result!.args.flags]).toEqual(["force"]);
  });

  it("parses quoted args", () => {
    const reg = createSlashCommandRegistry();
    const result = reg.parse("/say hello world");
    expect(result!.args.positional).toEqual(["hello", "world"]);
  });

  it("parses --key=value syntax", () => {
    const reg = createSlashCommandRegistry();
    const result = reg.parse("/config --key=value");
    expect(result!.args.named).toEqual({ key: "value" });
  });

  it("registers and executes commands", async () => {
    const reg = createSlashCommandRegistry();
    const execute = vi.fn().mockResolvedValue({ success: true, content: "done" });
    reg.register({ name: "ping", description: "Ping", execute });

    const parsed = reg.parse("/ping");
    const result = await reg.execute(parsed!.command, parsed!.args, mockContext());
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalled();
  });

  it("resolves commands by alias", async () => {
    const reg = createSlashCommandRegistry();
    const execute = vi.fn().mockResolvedValue({ success: true });
    reg.register({ name: "test", description: "Test", aliases: ["t"], execute });

    const cmd = reg.getCommand("t");
    expect(cmd).not.toBeNull();
    expect(cmd!.name).toBe("test");
  });

  it("returns help for visible commands", () => {
    const reg = createSlashCommandRegistry();
    reg.register({ name: "visible", description: "Visible", category: "general", execute: vi.fn() });
    reg.register({ name: "hidden", description: "Hidden", hidden: true, execute: vi.fn() });
    const help = reg.getHelp();
    expect(help.map(h => h.name)).toEqual(["visible"]);
  });

  it("reports unknown command", async () => {
    const reg = createSlashCommandRegistry();
    const parsed = reg.parse("/nonexistent");
    const result = await reg.execute(parsed!.command, parsed!.args, mockContext());
    expect(result.success).toBe(false);
  });

  it("loads BUILTIN_COMMANDS", () => {
    const reg = createSlashCommandRegistry();
    for (const cmd of BUILTIN_COMMANDS) {
      reg.register(cmd);
    }
    expect(reg.getCommand("help")).not.toBeNull();
    expect(reg.getCommand("clear")).not.toBeNull();
  });
});
