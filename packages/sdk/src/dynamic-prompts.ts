/**
 * P24-12: Dynamic System Prompts
 * Template-based prompts with variable interpolation.
 */

export interface PromptTemplate {
  /** Template name */
  name: string;
  /** Template content with {{variable}} placeholders */
  template: string;
  /** Variable definitions */
  variables: Array<{
    name: string;
    description: string;
    type: "string" | "number" | "boolean" | "array" | "object";
    required?: boolean;
    default?: unknown;
    /** Enum values for constrained selection */
    enum?: unknown[];
  }>;
  /** Template category */
  category?: string;
}

export interface PromptRenderer {
  /** Render a template with variables */
  render(template: string, variables: Record<string, unknown>): string;
  /** Validate that all required variables are provided */
  validate(template: string, variables: Record<string, unknown>): { valid: boolean; missing: string[] };
  /** Extract variable names from a template */
  extractVariables(template: string): string[];
}

export interface PromptTemplateRegistry {
  /** Register a template */
  register(template: PromptTemplate): void;
  /** Get a template by name */
  get(name: string): PromptTemplate | null;
  /** List all templates */
  list(category?: string): PromptTemplate[];
  /** Render a template by name */
  render(name: string, variables: Record<string, unknown>): string;
  /** Delete a template */
  delete(name: string): void;
}

export declare function createPromptRenderer(): PromptRenderer;
export declare function createPromptTemplateRegistry(): PromptTemplateRegistry;

/**
 * Built-in prompt templates.
 */
export declare const BUILTIN_PROMPT_TEMPLATES: PromptTemplate[];
