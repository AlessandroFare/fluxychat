export interface DynamicToolConfig {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute?: (input: unknown) => unknown | Promise<unknown>;
  [key: string]: unknown;
}

export type DynamicTool = DynamicToolConfig & { type: "dynamic" };

export function dynamicTool(tool: DynamicToolConfig): DynamicTool {
  return { ...tool, type: "dynamic" };
}

export interface DynamicToolRegistry {
  register(tool: DynamicTool): void;
  unregister(name: string): void;
  get(name: string): DynamicTool | undefined;
  list(): DynamicTool[];
  call(name: string, input: unknown): Promise<unknown>;
  clear(): void;
}

export function createDynamicToolRegistry(): DynamicToolRegistry {
  const tools = new Map<string, DynamicTool>();

  return {
    register(tool: DynamicTool) {
      tools.set(tool.name, tool);
    },

    unregister(name: string) {
      tools.delete(name);
    },

    get(name: string) {
      return tools.get(name);
    },

    list() {
      return Array.from(tools.values());
    },

    async call(name: string, input: unknown) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Dynamic tool "${name}" not found`);
      if (!tool.execute) throw new Error(`Dynamic tool "${name}" has no execute function`);
      return tool.execute(input);
    },

    clear() {
      tools.clear();
    },
  };
}

export function typeNarrowDynamicTool<TInput = unknown, TOutput = unknown>(
  tool: DynamicToolConfig,
): DynamicTool {
  return dynamicTool(tool) as DynamicTool & { execute: (input: TInput) => TOutput | Promise<TOutput> };
}

export interface ToolSet {
  [name: string]: DynamicTool;
}

export type ToolCallResult<T extends ToolSet> = {
  [K in keyof T]: T[K] extends DynamicTool
    ? T[K]["execute"] extends (input: infer I) => infer O | Promise<infer O>
      ? { toolName: K; input: I; output: O }
      : { toolName: K; input: unknown; output: unknown }
    : never;
}[keyof T];
