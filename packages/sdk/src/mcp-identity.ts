export interface McpServerInfo {
  name: string;
  version: string;
  vendor: string;
  description: string;
  homepageUrl?: string;
  docsUrl?: string;
}

export interface McpToolProvenance {
  serverName: string;
  serverVersion: string;
  toolName: string;
  instructions: string;
  origin: "builtin" | "installed" | "remote";
  signature?: string;
}

export interface McpInstructions {
  serverName: string;
  instructions: string;
  metadata: Record<string, string>;
  updatedAt: string;
}

export interface McpIdentityManager {
  registerServer(info: McpServerInfo): void;
  getServer(name: string): McpServerInfo | null;
  listServers(): McpServerInfo[];
  setInstructions(serverName: string, instructions: string): McpInstructions;
  getInstructions(serverName: string): McpInstructions | null;
  createToolProvenance(serverName: string, toolName: string, instructions: string): McpToolProvenance;
  getToolProvenance(serverName: string, toolName: string): McpToolProvenance | null;
  listToolsByServer(serverName: string): McpToolProvenance[];
}

export function createMcpIdentityManager(): McpIdentityManager {
  const servers = new Map<string, McpServerInfo>();
  const instructions = new Map<string, McpInstructions>();
  const toolProvenance = new Map<string, McpToolProvenance>();

  return {
    registerServer(info: McpServerInfo): void {
      servers.set(info.name, info);
    },

    getServer(name: string) { return servers.get(name) ?? null; },

    listServers() { return [...servers.values()]; },

    setInstructions(serverName: string, instr: string): McpInstructions {
      if (!servers.has(serverName)) throw new Error(`Server ${serverName} not registered.`);
      const entry: McpInstructions = {
        serverName,
        instructions: instr,
        metadata: {},
        updatedAt: new Date().toISOString(),
      };
      instructions.set(serverName, entry);
      return entry;
    },

    getInstructions(serverName: string) { return instructions.get(serverName) ?? null; },

    createToolProvenance(serverName: string, toolName: string, instr: string): McpToolProvenance {
      const server = servers.get(serverName);
      if (!server) throw new Error(`Server ${serverName} not registered.`);
      const key = `${serverName}:${toolName}`;
      const entry: McpToolProvenance = {
        serverName,
        serverVersion: server.version,
        toolName,
        instructions: instr,
        origin: "installed",
      };
      toolProvenance.set(key, entry);
      return entry;
    },

    getToolProvenance(serverName: string, toolName: string) {
      return toolProvenance.get(`${serverName}:${toolName}`) ?? null;
    },

    listToolsByServer(serverName: string) {
      return [...toolProvenance.values()].filter((t) => t.serverName === serverName);
    },
  };
}
