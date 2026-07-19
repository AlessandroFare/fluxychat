export type UIPartState = "call-available" | "input-available" | "output-available" | "output-error";

export interface TextUIPart {
  type: "text";
  text: string;
}

export interface ToolCallUIPart {
  type: `tool-${string}`;
  state: Extract<UIPartState, "call-available">;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultUIPart<T = unknown> {
  type: `tool-${string}`;
  state: "input-available" | "output-available" | "output-error";
  toolCallId: string;
  toolName: string;
  errorText?: string;
  output?: T;
}

export type UIPart<T = unknown> = TextUIPart | ToolCallUIPart | ToolResultUIPart<T>;

export interface ComponentRenderer<TProps = Record<string, unknown>> {
  render: (props: TProps) => string;
}

export interface ComponentRegistryEntry {
  component: ComponentRenderer;
  loadingComponent?: ComponentRenderer;
  errorComponent?: ComponentRenderer;
}

export interface ComponentRegistry {
  register(toolName: string, entry: ComponentRegistryEntry): void;
  unregister(toolName: string): boolean;
  get(toolName: string): ComponentRegistryEntry | undefined;
  has(toolName: string): boolean;
  clear(): void;
  entries(): Map<string, ComponentRegistryEntry>;
}

export interface RenderPartsOptions {
  onLoading?: (toolName: string, toolCallId: string) => string;
  onError?: (toolName: string, toolCallId: string, errorText: string) => string;
}

export function createTextPart(text: string): TextUIPart {
  return { type: "text", text };
}

export function createToolCallPart(toolName: string, toolCallId: string, args: Record<string, unknown>): ToolCallUIPart {
  return { type: `tool-${toolName}`, state: "call-available", toolCallId, toolName, args };
}

export function createToolResultPart<T>(
  toolName: string,
  toolCallId: string,
  state: "input-available" | "output-available" | "output-error",
  output?: T,
  errorText?: string,
): ToolResultUIPart<T> {
  return { type: `tool-${toolName}`, state, toolCallId, toolName, output, errorText } as ToolResultUIPart<T>;
}

export function createComponentRegistry(): ComponentRegistry {
  const registry = new Map<string, ComponentRegistryEntry>();

  return {
    register(toolName, entry) {
      registry.set(toolName, entry);
    },

    unregister(toolName) {
      return registry.delete(toolName);
    },

    get(toolName) {
      return registry.get(toolName);
    },

    has(toolName) {
      return registry.has(toolName);
    },

    clear() {
      registry.clear();
    },

    entries() {
      return registry;
    },
  };
}

export function renderParts(
  parts: UIPart[],
  registry: ComponentRegistry,
  options?: RenderPartsOptions,
): string[] {
  return parts.map((part) => {
    if (part.type === "text") return part.text;

    const entry = registry.get(part.toolName);

    if (part.state === "call-available" || part.state === "input-available") {
      if (entry?.loadingComponent) return entry.loadingComponent.render(part as any);
      if (options?.onLoading) return options.onLoading(part.toolName, part.toolCallId);
      if (entry) return `[${part.toolName} loading...]`;
      return `[${part.toolName}]`;
    }

    if (part.state === "output-error") {
      const errorText = part.errorText || "Unknown error";
      if (entry?.errorComponent) return entry.errorComponent.render({ errorText, ...part.output } as any);
      if (options?.onError) return options.onError(part.toolName, part.toolCallId, errorText);
      if (entry) return `[${part.toolName} error: ${errorText}]`;
      return `[${part.toolName}]`;
    }

    if (part.state === "output-available") {
      if (entry) return entry.component.render(part.output as any);
      return `[${part.toolName}]`;
    }

    return "";
  });
}

export function partTypeFor(toolName: string): `tool-${string}` {
  return `tool-${toolName}`;
}

export function parseToolName(type: string): string | null {
  const match = /^tool-(.+)$/.exec(type);
  return match ? match[1] : null;
}

export function isTextPart(part: UIPart): part is TextUIPart {
  return part.type === "text";
}

export function isToolPart(part: UIPart): part is ToolCallUIPart | ToolResultUIPart {
  return part.type.startsWith("tool-");
}

export function isToolCallPart(part: UIPart): part is ToolCallUIPart {
  return isToolPart(part) && part.state === "call-available";
}

export function isToolResultPart<T>(part: UIPart): part is ToolResultUIPart<T> {
  return isToolPart(part) && part.state !== "call-available";
}
