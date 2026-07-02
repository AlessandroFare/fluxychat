/**
 * P24-3: Provider-defined Tools — Worker Implementation
 * Provider supplies schema/description, developer provides execute.
 */

/**
 * Create a provider tool registry.
 */
export function createProviderToolRegistry() {
  const providers = new Map(); // provider -> ProviderDefinedTool[]
  const toolsByName = new Map(); // name -> ProviderDefinedTool

  return {
    register(toolSet) {
      const existing = providers.get(toolSet.provider) || [];
      providers.set(toolSet.provider, [...existing, ...toolSet.tools]);
      for (const tool of toolSet.tools) {
        toolsByName.set(tool.name, { ...tool, provider: toolSet.provider });
      }
    },

    getAllTools() {
      return [...toolsByName.values()];
    },

    getByProvider(provider) {
      return providers.get(provider) || [];
    },

    get(name) {
      return toolsByName.get(name) || null;
    },

    has(name) {
      return toolsByName.has(name);
    },
  };
}

/**
 * Built-in provider tool sets.
 */
export const PROVIDER_TOOL_SETS = {
  webSearch: {
    provider: "fluxychat-web",
    tools: [
      {
        name: "web_search",
        description: "Search the web for information on any topic. Returns relevant URLs, titles, and snippets.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            numResults: { type: "number", description: "Number of results (1-10)", default: 5 },
          },
          required: ["query"],
        },
        execute: async (input, ctx) => {
          // Web search execution — in production, call a search API
          return { results: [], query: input.query };
        },
        category: "search",
      },
      {
        name: "fetch_url",
        description: "Fetch content from a URL. Returns the page content as text.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            format: { type: "string", enum: ["text", "markdown", "html"], default: "markdown" },
          },
          required: ["url"],
        },
        execute: async (input, ctx) => {
          const resp = await fetch(input.url, { signal: ctx.signal });
          const text = await resp.text();
          return { content: text.slice(0, 10000), url: input.url, status: resp.status };
        },
        category: "search",
      },
    ],
  },

  codeExecution: {
    provider: "fluxychat-code",
    tools: [
      {
        name: "execute_code",
        description: "Execute JavaScript/TypeScript code in a sandboxed environment. Returns stdout, stderr, and result.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Code to execute" },
            language: { type: "string", enum: ["javascript", "typescript"], default: "javascript" },
          },
          required: ["code"],
        },
        execute: async (input, ctx) => {
          // Sandboxed code execution
          return { stdout: "", stderr: "", result: null };
        },
        category: "code",
        timeoutMs: 30_000,
      },
    ],
  },

  fileOperations: {
    provider: "fluxychat-files",
    tools: [
      {
        name: "read_file",
        description: "Read the contents of a file from the project.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read" },
          },
          required: ["path"],
        },
        execute: async (input, ctx) => {
          return { content: "", path: input.path };
        },
        category: "data",
      },
      {
        name: "write_file",
        description: "Write content to a file in the project.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to write" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["path", "content"],
        },
        execute: async (input, ctx) => {
          return { success: true, path: input.path };
        },
        category: "data",
        requiresApproval: true,
      },
    ],
  },

  dataAnalysis: {
    provider: "fluxychat-data",
    tools: [
      {
        name: "analyze_data",
        description: "Analyze structured data (CSV, JSON) and return insights, statistics, and visualizations.",
        inputSchema: {
          type: "object",
          properties: {
            data: { description: "Data to analyze (array of objects or CSV string)" },
            analysis: { type: "string", description: "Type of analysis: summary, correlation, trend, distribution" },
          },
          required: ["data", "analysis"],
        },
        execute: async (input, ctx) => {
          return { statistics: {}, insights: [], charts: [] };
        },
        category: "data",
      },
    ],
  },
};

/**
 * Convert provider-defined tools to FluxyChat tool schema format.
 * @param {Array} tools
 */
export function providerToolsToSchema(tools) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}
