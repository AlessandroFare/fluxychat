/**
 * P24-7: Structured Output
 * JSON schema constrained generation for LLM responses.
 */

export interface StructuredOutputConfig<T = unknown> {
  /** JSON Schema for the expected output */
  schema: Record<string, unknown>;
  /** Default value if generation fails */
  defaultValue?: T;
  /** Whether to retry on parse failure */
  retryOnFailure?: boolean;
  /** Maximum retries */
  maxRetries?: number;
  /** Whether to use function calling for structured output (vs JSON mode) */
  useFunctionCalling?: boolean;
}

export interface StructuredOutputResult<T> {
  /** The parsed object */
  object: T | null;
  /** Whether the output matched the schema */
  valid: boolean;
  /** Parse errors if any */
  errors?: string[];
  /** Raw text from the LLM */
  rawText: string;
  /** Token usage */
  usage?: { input: number; output: number };
}

/**
 * Generate a system prompt suffix that instructs the LLM to output valid JSON.
 */
export declare function structuredOutputPrompt(schema: Record<string, unknown>): string;

/**
 * Parse LLM output as structured JSON according to a schema.
 */
export declare function parseStructuredOutput<T>(
  text: string,
  schema: Record<string, unknown>,
): StructuredOutputResult<T>;

/**
 * Validate an object against a JSON schema (basic validation).
 */
export declare function validateAgainstSchema(
  obj: unknown,
  schema: Record<string, unknown>,
): { valid: boolean; errors: string[] };

/**
 * Create a structured output wrapper for an LLM call.
 */
export declare function withStructuredOutput<T>(
  llmCall: () => Promise<string>,
  config: StructuredOutputConfig<T>,
): Promise<StructuredOutputResult<T>>;
