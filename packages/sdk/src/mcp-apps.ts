import { dynamicTool } from "./dynamic-tools";
import { createGuiSandboxManager } from "./gui-sandbox";

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app" as const;
export const MCP_APP_EXTENSION_NAME = "io.modelcontextprotocol/ui" as const;

export type MCPAppToolVisibility = "model" | "app";

export interface MCPAppToolMeta {
  resourceUri?: string;
  visibility?: MCPAppToolVisibility[];
  [key: string]: unknown;
}

export interface MCPAppResourceCSP {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  [key: string]: unknown;
}

export interface MCPAppResourceMeta {
  prefersBorder?: boolean;
  csp?: MCPAppResourceCSP;
  permissions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MCPAppResource {
  uri: string;
  mimeType: typeof MCP_APP_MIME_TYPE;
  html: string;
  meta?: MCPAppResourceMeta;
}

export interface MCPAppToolLike {
  _meta?: {
    ui?: MCPAppToolMeta;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ListToolsResult {
  tools: Array<{ name: string; title?: string; description?: string; inputSchema?: unknown; _meta?: Record<string, unknown> }>;
}

export const mcpAppClientCapabilities = {
  experimental: {
    mcpApp: {
      mimeTypes: [MCP_APP_MIME_TYPE],
    },
  },
};

export function getMCPAppToolMeta(tool: MCPAppToolLike): MCPAppToolMeta | undefined {
  return tool._meta?.ui;
}

export function getMCPAppResourceUri(tool: MCPAppToolLike): string | undefined {
  return tool._meta?.ui?.resourceUri;
}

export function isMCPAppTool(tool: MCPAppToolLike): boolean {
  const uri = getMCPAppResourceUri(tool);
  return typeof uri === "string" && uri.startsWith("ui://");
}

export function splitMCPAppTools(definitions: ListToolsResult): {
  modelVisible: ListToolsResult;
  appVisible: ListToolsResult;
} {
  const modelVisible: ListToolsResult["tools"] = [];
  const appVisible: ListToolsResult["tools"] = [];

  for (const tool of definitions.tools) {
    const meta = getMCPAppToolMeta(tool);
    const visibility = meta?.visibility ?? ["model"];
    if (visibility.includes("model")) modelVisible.push(tool);
    if (visibility.includes("app")) appVisible.push(tool);
  }

  return {
    modelVisible: { tools: modelVisible },
    appVisible: { tools: appVisible },
  };
}

export function getMCPAppResourceUris(definitions: ListToolsResult): string[] {
  const uris = new Set<string>();
  for (const tool of definitions.tools) {
    const uri = getMCPAppResourceUri(tool);
    if (uri) uris.add(uri);
  }
  return Array.from(uris);
}

export function getMCPAppResourceFromReadResult({
  uri,
  resource,
}: {
  uri: string;
  resource: { text?: string; blob?: string; mimeType?: string; meta?: MCPAppResourceMeta };
}): MCPAppResource {
  const html = resource.text
    ? resource.text
    : resource.blob
      ? Buffer.from(resource.blob, "base64").toString("utf-8")
      : "";

  return {
    uri,
    mimeType: (resource.mimeType ?? MCP_APP_MIME_TYPE) as typeof MCP_APP_MIME_TYPE,
    html,
    meta: resource.meta,
  };
}

export interface ReadMCPAppResourceOptions {
  client: { readResource: (args: { uri: string }) => Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }> };
  uri: string;
  options?: { signal?: AbortSignal };
}

export async function readMCPAppResource({
  client,
  uri,
}: ReadMCPAppResourceOptions): Promise<MCPAppResource> {
  if (!uri.startsWith("ui://")) {
    throw new Error(`Invalid MCP App resource URI: "${uri}". Must start with "ui://"`);
  }

  const result = await client.readResource({ uri });
  if (result.contents.length === 0) {
    throw new Error(`No content found for MCP App resource "${uri}"`);
  }

  const resource = result.contents[0];
  if (resource.mimeType !== MCP_APP_MIME_TYPE) {
    throw new Error(`Invalid MIME type for MCP App resource "${uri}": expected "${MCP_APP_MIME_TYPE}", got "${resource.mimeType}"`);
  }

  return getMCPAppResourceFromReadResult({
    uri,
    resource: {
      text: resource.text,
      blob: resource.blob,
      mimeType: resource.mimeType,
    },
  });
}

export function createMCPAppsClientCapabilities() {
  return { ...mcpAppClientCapabilities };
}

export interface MCPAppManager {
  isMCPAppTool(tool: Record<string, unknown>): boolean;
  getAppMeta(tool: Record<string, unknown>): MCPAppToolMeta | undefined;
  splitTools(tools: ListToolsResult): { modelVisible: ListToolsResult; appVisible: ListToolsResult };
  readResource(client: ReadMCPAppResourceOptions["client"], uri: string): Promise<MCPAppResource>;
  createSandboxedRenderer(resource: MCPAppResource): ReturnType<typeof createGuiSandboxManager>;
}

export function createMCPAppManager(): MCPAppManager {
  return {
    isMCPAppTool(tool: Record<string, unknown>) {
      return isMCPAppTool(tool as MCPAppToolLike);
    },

    getAppMeta(tool: Record<string, unknown>) {
      return getMCPAppToolMeta(tool as MCPAppToolLike);
    },

    splitTools(tools: ListToolsResult) {
      return splitMCPAppTools(tools);
    },

    async readResource(client, uri) {
      return readMCPAppResource({ client, uri });
    },

    createSandboxedRenderer(resource: MCPAppResource) {
      return createGuiSandboxManager({
        allowedOrigins: ["*"],
        maxRendersPerMinute: 10,
        cspDirectives: {
          "default-src": ["'self'"],
          "script-src": ["'none'"],
          "style-src": ["'unsafe-inline'"],
        },
      });
    },
  };
}
