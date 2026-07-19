export interface SlashCommand {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  requiredArgs?: Array<{ name: string; description: string; type: "string" | "number" | "boolean" }>;
  optionalArgs?: Array<{ name: string; description: string; type: "string" | "number" | "boolean"; default?: unknown }>;
  adminOnly?: boolean;
  hidden?: boolean;
  category?: "general" | "admin" | "moderation" | "agent" | "utility" | "custom";
  execute: (args: ParsedArgs, context: CommandContext) => Promise<CommandResult>;
}

export interface ParsedArgs {
  raw: string;
  positional: string[];
  named: Record<string, string>;
  flags: Set<string>;
}

export interface CommandContext {
  userId: string;
  roomId: string;
  projectId: string;
  agentId?: string;
  isAdmin: boolean;
  reply: (content: string) => Promise<void>;
  mentions?: string[];
}

export interface CommandResult {
  success: boolean;
  content?: string;
  suppressNotFound?: boolean;
}

export interface SlashCommandRegistry {
  register(command: SlashCommand): void;
  parse(message: string): { command: string; args: ParsedArgs } | null;
  execute(command: string, args: ParsedArgs, context: CommandContext): Promise<CommandResult>;
  getHelp(): Array<{ name: string; description: string; usage?: string; category?: string }>;
  getCommand(name: string): SlashCommand | null;
}

function parseArgs(raw: string): ParsedArgs {
  const positional: string[] = [];
  const named: Record<string, string> = {};
  const flags = new Set<string>();

  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (const ch of raw) {
    if (ch === '"' || ch === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (ch === " " && !inQuote) {
      if (current) { tokens.push(current); current = ""; }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("--")) {
      const eqIdx = token.indexOf("=");
      if (eqIdx > 2) {
        named[token.slice(2, eqIdx)] = token.slice(eqIdx + 1);
      } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith("-")) {
        named[token.slice(2)] = tokens[++i];
      } else {
        flags.add(token.slice(2));
      }
    } else if (token.startsWith("-") && token.length > 1 && token[1] !== "-") {
      flags.add(token.slice(1));
    } else {
      positional.push(token);
    }
  }

  return { raw, positional, named, flags };
}

export function createSlashCommandRegistry(): SlashCommandRegistry {
  const commands = new Map<string, SlashCommand>();

  function normalize(name: string): string {
    return name.toLowerCase().replace(/^\//, "");
  }

  function resolve(name: string): SlashCommand | null {
    const key = normalize(name);
    const cmd = commands.get(key);
    if (cmd) return cmd;
    for (const c of commands.values()) {
      if (c.aliases?.some(a => normalize(a) === key)) return c;
    }
    return null;
  }

  return {
    register(command: SlashCommand) {
      commands.set(normalize(command.name), command);
    },

    parse(message: string): { command: string; args: ParsedArgs } | null {
      const trimmed = message.trim();
      if (!trimmed.startsWith("/")) return null;
      const spaceIdx = trimmed.indexOf(" ");
      const cmd = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
      if (!cmd) return null;
      const rawArgs = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();
      return { command: cmd, args: parseArgs(rawArgs) };
    },

    async execute(command: string, args: ParsedArgs, context: CommandContext): Promise<CommandResult> {
      const cmd = resolve(command);
      if (!cmd) {
        return { success: false, content: `Unknown command: /${command}`, suppressNotFound: true };
      }
      return cmd.execute(args, context);
    },

    getHelp() {
      const visible = [...commands.values()].filter(c => !c.hidden);
      return visible.map(c => ({
        name: c.name,
        description: c.description,
        usage: c.usage,
        category: c.category,
      }));
    },

    getCommand(name: string) {
      return resolve(name);
    },
  };
}

export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: "help",
    description: "Show available commands",
    usage: "/help [command]",
    category: "general",
    execute: async (_args, context) => {
      return { success: true, content: "Available commands: /help, /clear" };
    },
  },
  {
    name: "clear",
    description: "Clear the conversation",
    usage: "/clear",
    category: "utility",
    execute: async (_args, _context) => {
      return { success: true, content: "Conversation cleared" };
    },
  },
];
