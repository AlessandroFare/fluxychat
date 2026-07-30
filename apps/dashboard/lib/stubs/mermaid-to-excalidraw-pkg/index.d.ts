export interface MermaidConfig {
  theme?: string;
  themeVariables?: Record<string, string>;
}

export interface ExcalidrawConfig {
  fontSize?: number;
}

export declare function parseMermaidToExcalidraw(
  definition: string,
  config?: MermaidConfig,
): Promise<{ elements: unknown[]; files: null }>;
