/**
 * P23-3: MCP Integration — Worker Implementation
 * MCP client converting MCP tools to FluxyChat tool format.
 *
 * Includes MCP Resources support for application-driven data sources.
 */
import { safeOutboundFetch } from "./url-ssrf.js";
import {
  MCP_ERROR_UNSUPPORTED_PROTOCOL,
  MCP_LEGACY_PROTOCOL_VERSION,
  MCP_META_CLIENT_CAPABILITIES,
  MCP_META_CLIENT_INFO,
  MCP_META_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION,
} from "./mcp-protocol.js";

/**
 * Convert MCP tool definitions to FluxyChat tool format.
 * @param {Array} tools - MCP tool definitions
 */
export function mcpToolsToFluxyChat(tools) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: `mcp_${tool.name}`,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
}

/**
 * Convert FluxyChat tool result to MCP format.
 * @param {*} result - Tool result
 */
export function fluxyChatResultToMcp(result) {
  if (result == null) {
    return { content: [{ type: "text", text: "No result" }] };
  }
  if (typeof result === "string") {
    return { content: [{ type: "text", text: result }] };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

// =============================================================================
// MCP Resources
// =============================================================================

/**
 * @typedef {Object} McpResource
 * @property {string} uri - Resource URI (e.g., "file:///path/to/file", "postgres://db/table")
 * @property {string} name - Human-readable name
 * @property {string} [description] - Resource description
 * @property {string} [mimeType] - MIME type (e.g., "text/plain", "application/json")
 */

/**
 * @typedef {Object} McpResourceContent
 * @property {string} uri - Resource URI
 * @property {string} [mimeType] - MIME type
 * @property {string} [text] - Text content
 * @property {string} [blob] - Base64-encoded binary content
 */

/**
 * Create an MCP resource manager for handling application-driven data sources.
 * Resources can be passed as context to LLM calls.
 */
export function createMcpResourceManager() {
  /** @type {Map<string, McpResource & { provider: (uri: string) => Promise<McpResourceContent> }>} */
  const resources = new Map();

  return {
    /**
     * Register a resource provider.
     * @param {McpResource} resource - Resource metadata
     * @param {(uri: string) => Promise<McpResourceContent>} provider - Content provider
     */
    register(resource, provider) {
      resources.set(resource.uri, { ...resource, provider });
    },

    /**
     * List all registered resources.
     * @returns {McpResource[]}
     */
    list() {
      return Array.from(resources.values()).map(({ provider, ...resource }) => resource);
    },

    /**
     * Read resource content by URI.
     * @param {string} uri - Resource URI
     * @returns {Promise<McpResourceContent | null>}
     */
    async read(uri) {
      const entry = resources.get(uri);
      if (!entry) {
        return null;
      }
      try {
        return await entry.provider(uri);
      } catch (error) {
        return {
          uri,
          mimeType: "text/plain",
          text: `Error reading resource: ${error.message}`,
        };
      }
    },

    /**
     * Read multiple resources and return as context array.
     * @param {string[]} uris - Resource URIs to read
     * @returns {Promise<Array<{ uri: string, name: string, content: string }>>}
     */
    async readAsContext(uris) {
      const context = [];
      for (const uri of uris) {
        const entry = resources.get(uri);
        if (!entry) continue;

        const content = await this.read(uri);
        if (content) {
          context.push({
            uri,
            name: entry.name,
            content: content.text || content.blob || "",
          });
        }
      }
      return context;
    },

    /**
     * Unregister a resource.
     * @param {string} uri - Resource URI
     * @returns {boolean}
     */
    unregister(uri) {
      return resources.delete(uri);
    },

    /**
     * Check if a resource is registered.
     * @param {string} uri - Resource URI
     * @returns {boolean}
     */
    has(uri) {
      return resources.has(uri);
    },
  };
}

// =============================================================================
// Built-in Resource Providers
// =============================================================================

/**
 * Create a file system resource provider.
 * @param {string} basePath - Base directory path
 * @returns {(uri: string) => Promise<McpResourceContent>}
 */
export function createFileSystemProvider(basePath) {
  return async (uri) => {
    const path = uri.replace("file://", "");
    // In Cloudflare Workers, we can't access local filesystem
    // This would be used in Node.js environments or via R2
    return {
      uri,
      mimeType: "text/plain",
      text: `File content for ${path} (not available in Workers)`,
    };
  };
}

/**
 * Create a database resource provider.
 * @param {D1Database} db - Cloudflare D1 database
 * @returns {(uri: string) => Promise<McpResourceContent>}
 */
export function createDatabaseProvider(db) {
  return async (uri) => {
    // Parse URI: postgres://db/table or d1://db/table
    const match = uri.match(/^d1:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      return { uri, mimeType: "text/plain", text: "Invalid D1 URI format" };
    }

    const [, database, table] = match;
    try {
      const result = await db.prepare(`SELECT * FROM ${table} LIMIT 100`).all();
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result.results, null, 2),
      };
    } catch (error) {
      return { uri, mimeType: "text/plain", text: `Database error: ${error.message}` };
    }
  };
}

/**
 * Create an API resource provider.
 * @param {string} baseUrl - API base URL
 * @param {Object} [headers] - Request headers
 * @returns {(uri: string) => Promise<McpResourceContent>}
 */
export function createApiProvider(baseUrl, headers = {}) {
  return async (uri) => {
    const path = uri.replace("api://", "");
    try {
      const response = await safeOutboundFetch(`${baseUrl}/${path}`, { headers });
      if (!response.ok) {
        return { uri, mimeType: "text/plain", text: `API error: ${response.status}` };
      }
      const text = await response.text();
      return { uri, mimeType: "application/json", text };
    } catch (error) {
      return { uri, mimeType: "text/plain", text: `API error: ${error.message}` };
    }
  };
}

/**
 * Create an MCP client for a single server.
 * @param {Object} config - Server config
 * @param {Object} [opts] - Options
 */
export function createMcpClient(config, opts = {}) {
  const { maxRetries = 3, timeoutMs = 30_000 } = opts;
  const clientInfo = { name: "fluxychat-agent", version: "1.0.0" };
  let connected = false;
  let tools = [];
  let era = "modern";
  let protocolVersion = MCP_PROTOCOL_VERSION;

  function metaParams(extra = {}) {
    return {
      ...extra,
      _meta: {
        [MCP_META_PROTOCOL_VERSION]: protocolVersion,
        [MCP_META_CLIENT_INFO]: clientInfo,
        [MCP_META_CLIENT_CAPABILITIES]: { tools: {} },
      },
    };
  }

  function headersFor(method, name) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...config.headers,
    };
    if (era === "modern") {
      headers["MCP-Protocol-Version"] = protocolVersion;
      headers["Mcp-Method"] = method;
      if (name) headers["Mcp-Name"] = name;
    }
    return headers;
  }

  async function rpc(method, params, extraHeaders = {}) {
    if (!config.url) {
      return { error: { message: "No URL configured" } };
    }
    const name = method === "tools/call" ? params?.name : method === "resources/read" ? params?.uri : undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const resp = await safeOutboundFetch(config.url, {
            method: "POST",
            headers: { ...headersFor(method, name), ...extraHeaders },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: crypto.randomUUID(),
              method,
              params: era === "modern" ? metaParams(params) : params,
            }),
            signal: controller.signal,
          });
          const data = await resp.json().catch(() => null);
          if (data) return data;
          throw new Error(`HTTP ${resp.status}`);
        } catch (err) {
          if (attempt === maxRetries) throw err;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    } finally {
      clearTimeout(timeout);
    }
    return { error: { message: "MCP request failed" } };
  }

  return {
    async connect() {
      era = "modern";
      protocolVersion = MCP_PROTOCOL_VERSION;
      const discovered = await rpc("server/discover", {});
      const supported = discovered?.result?.supportedVersions;
      if (Array.isArray(supported) && supported.length) {
        protocolVersion = supported.includes(MCP_PROTOCOL_VERSION)
          ? MCP_PROTOCOL_VERSION
          : supported[0];
        era = protocolVersion === MCP_PROTOCOL_VERSION ? "modern" : "legacy";
      } else if (
        discovered?.error &&
        discovered.error.code !== MCP_ERROR_UNSUPPORTED_PROTOCOL
      ) {
        era = "legacy";
        protocolVersion = MCP_LEGACY_PROTOCOL_VERSION;
        await rpc("initialize", {
          protocolVersion: MCP_LEGACY_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo,
        });
      }

      const listed = await rpc("tools/list", {});
      tools = listed?.result?.tools || [];
      connected = true;
    },

    async disconnect() {
      connected = false;
      tools = [];
    },

    async listTools() {
      if (!connected) throw new Error("MCP client not connected");
      const listed = await rpc("tools/list", {});
      tools = listed?.result?.tools || tools;
      return tools;
    },

    async callTool(call) {
      if (!connected) throw new Error("MCP client not connected");
      if (!config.url) {
        return { content: [{ type: "text", text: "No URL configured" }], isError: true };
      }
      const data = await rpc("tools/call", { name: call.name, arguments: call.arguments || {} });
      if (data?.error) {
        return {
          content: [{ type: "text", text: data.error.message || "MCP error" }],
          isError: true,
        };
      }
      return data?.result || { content: [{ type: "text", text: "Empty result" }] };
    },

    isConnected() {
      return connected;
    },
  };
}

/**
 * Create an MCP registry managing multiple servers.
 */
export function createMcpRegistry() {
  const servers = new Map(); // name -> { config, client, tools }

  return {
    register(config) {
      servers.set(config.name, {
        config,
        client: createMcpClient(config),
        tools: [],
      });
    },

    async connectAll() {
      for (const [name, entry] of servers) {
        try {
          await entry.client.connect();
          entry.tools = await entry.client.listTools();
        } catch (err) {
          console.error(`MCP server "${name}" connect failed:`, err.message);
        }
      }
    },

    async disconnectAll() {
      for (const [, entry] of servers) {
        await entry.client.disconnect();
      }
    },

    async getAllTools() {
      const allTools = [];
      for (const [, entry] of servers) {
        if (entry.client.isConnected()) {
          allTools.push(...entry.tools);
        }
      }
      return allTools;
    },

    async callTool(call) {
      // Route to the correct server by tool name prefix
      for (const [, entry] of servers) {
        if (entry.client.isConnected()) {
          const matchingTool = entry.tools.find((t) => t.name === call.name);
          if (matchingTool) {
            return entry.client.callTool(call);
          }
        }
      }
      return {
        content: [{ type: "text", text: `No MCP server has tool "${call.name}"` }],
        isError: true,
      };
    },

    getStatus() {
      return Array.from(servers.entries()).map(([name, entry]) => ({
        name,
        connected: entry.client.isConnected(),
        toolCount: entry.tools.length,
      }));
    },
  };
}
