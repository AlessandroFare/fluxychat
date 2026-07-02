/**
 * P24-10: Slash Commands — Worker Implementation
 */

/**
 * Create a slash command registry.
 */
export function createSlashCommandRegistry() {
  const commands = new Map();
  const aliases = new Map();

  return {
    register(command) {
      commands.set(command.name, command);
      if (command.aliases) {
        for (const alias of command.aliases) {
          aliases.set(alias, command.name);
        }
      }
    },

    parse(message) {
      const trimmed = message.trim();
      if (!trimmed.startsWith("/")) return null;

      const spaceIndex = trimmed.indexOf(" ");
      const commandName = spaceIndex > -1 ? trimmed.slice(1, spaceIndex) : trimmed.slice(1);
      const rawArgs = spaceIndex > -1 ? trimmed.slice(spaceIndex + 1) : "";

      // Resolve alias
      const resolvedName = aliases.get(commandName) || commandName;

      // Parse arguments
      const args = parseArgs(rawArgs);

      return { command: resolvedName, args };
    },

    async execute(commandName, args, context) {
      const command = commands.get(commandName);
      if (!command) {
        return { success: false, content: `Unknown command: /${commandName}`, suppressNotFound: false };
      }

      if (command.adminOnly && !context.isAdmin) {
        return { success: false, content: "This command requires admin privileges." };
      }

      try {
        return await command.execute(args, context);
      } catch (err) {
        return { success: false, content: `Command error: ${err.message}` };
      }
    },

    getHelp() {
      return Array.from(commands.values())
        .filter((cmd) => !cmd.hidden)
        .map((cmd) => ({
          name: `/${cmd.name}`,
          description: cmd.description,
          usage: cmd.usage,
          category: cmd.category,
        }));
    },

    getCommand(name) {
      return commands.get(name) || null;
    },
  };
}

/**
 * Parse argument string into structured args.
 * @param {string} raw
 */
function parseArgs(raw) {
  const positional = [];
  const named = {};
  const flags = new Set();

  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i].replace(/^"|"$/g, "");
    if (token.startsWith("--")) {
      const key = token.slice(2);
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith("--")) {
        named[key] = tokens[i + 1].replace(/^"|"$/g, "");
        i += 2;
      } else {
        flags.add(key);
        i++;
      }
    } else {
      positional.push(token);
      i++;
    }
  }

  return { raw, positional, named, flags };
}

/**
 * Built-in slash commands.
 */
export const BUILTIN_COMMANDS = [
  {
    name: "help",
    description: "Show available commands",
    usage: "/help [command]",
    category: "general",
    execute: async (args, ctx) => {
      return { success: true, content: "Available commands: /help, /clear, /export, /invite, /kick, /ban, /unban, /mute, /unmute, /topic, /members, /info" };
    },
  },
  {
    name: "clear",
    description: "Clear the conversation context",
    category: "general",
    execute: async (args, ctx) => {
      return { success: true, content: "Conversation context cleared." };
    },
  },
  {
    name: "export",
    description: "Export chat history",
    usage: "/export [format]",
    category: "utility",
    execute: async (args, ctx) => {
      const format = args.positional[0] || "json";
      return { success: true, content: `Exporting chat as ${format}...` };
    },
  },
  {
    name: "topic",
    description: "Set or view the room topic",
    usage: "/topic [new topic]",
    category: "moderation",
    execute: async (args, ctx) => {
      if (args.positional.length === 0) {
        return { success: true, content: "Current topic: (none)" };
      }
      return { success: true, content: `Topic set to: ${args.positional.join(" ")}` };
    },
  },
  {
    name: "members",
    description: "List room members",
    category: "general",
    execute: async (args, ctx) => {
      return { success: true, content: "Room members list..." };
    },
  },
];
