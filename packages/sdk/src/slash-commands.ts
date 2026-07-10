/**
 * P24-10: Slash Commands
 * Command parsing and routing for chat messages.
 */

export interface SlashCommand {
  /** Command name (without /) */
  name: string;
  /** Command description */
  description: string;
  /** Usage syntax */
  usage?: string;
  /** Command aliases */
  aliases?: string[];
  /** Required arguments */
  requiredArgs?: Array<{ name: string; description: string; type: "string" | "number" | "boolean" }>;
  /** Optional arguments */
  optionalArgs?: Array<{ name: string; description: string; type: "string" | "number" | "boolean"; default?: unknown }>;
  /** Whether the command requires admin privileges */
  adminOnly?: boolean;
  /** Whether the command is visible in help */
  hidden?: boolean;
  /** Command category */
  category?: "general" | "admin" | "moderation" | "agent" | "utility" | "custom";
  /** Execute function */
  execute: (args: ParsedArgs, context: CommandContext) => Promise<CommandResult>;
}

export interface ParsedArgs {
  /** Raw argument string */
  raw: string;
  /** Parsed positional arguments */
  positional: string[];
  /** Parsed named arguments (--key value) */
  named: Record<string, string>;
  /** Flag arguments (--flag) */
  flags: Set<string>;
}

export interface CommandContext {
  userId: string;
  roomId: string;
  projectId: string;
  agentId?: string;
  isAdmin: boolean;
  /** Send a message back to the room */
  reply: (content: string) => Promise<void>;
  /** Get bot mentions */
  mentions?: string[];
}

export interface CommandResult {
  success: boolean;
  content?: string;
  /** Whether to suppress the default "command not found" message */
  suppressNotFound?: boolean;
}

export interface SlashCommandRegistry {
  /** Register a command */
  register(command: SlashCommand): void;
  /** Parse a message and check if it's a slash command */
  parse(message: string): { command: string; args: ParsedArgs } | null;
  /** Execute a parsed command */
  execute(command: string, args: ParsedArgs, context: CommandContext): Promise<CommandResult>;
  /** Get all visible commands for help */
  getHelp(): Array<{ name: string; description: string; usage?: string; category?: string }>;
  /** Get a command by name or alias */
  getCommand(name: string): SlashCommand | null;
}

export function createSlashCommandRegistry(): SlashCommandRegistry {
  throw new Error("createSlashCommandRegistry not implemented in SDK - use worker runtime");
}

/**
 * Built-in slash commands.
 */
export const BUILTIN_COMMANDS: SlashCommand[] = [];
