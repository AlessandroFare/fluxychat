export interface CallOptionsSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "enum" | "array";
    required?: boolean;
    default?: unknown;
    enumValues?: string[];
    description?: string;
  };
}

export type InferCallOptions<T extends CallOptionsSchema> = {
  [K in keyof T as T[K]["required"] extends false ? never : K]: T[K]["type"] extends "string"
    ? string
    : T[K]["type"] extends "number"
      ? number
      : T[K]["type"] extends "boolean"
        ? boolean
        : T[K]["type"] extends "enum"
          ? T[K]["enumValues"] extends readonly string[]
            ? T[K]["enumValues"][number]
            : string
          : T[K]["type"] extends "array"
            ? unknown[]
            : unknown;
} & {
  [K in keyof T as T[K]["required"] extends false ? K : never]?: T[K]["type"] extends "string"
    ? string
    : T[K]["type"] extends "number"
      ? number
      : T[K]["type"] extends "boolean"
        ? boolean
        : T[K]["type"] extends "enum"
          ? T[K]["enumValues"] extends readonly string[]
            ? T[K]["enumValues"][number]
            : string
          : T[K]["type"] extends "array"
            ? unknown[]
            : unknown;
};

export function callOptionsSchema<T extends CallOptionsSchema>(schema: T): T {
  return schema;
}

export interface PrepareCallContext<TOptions extends Record<string, unknown>> {
  options: TOptions;
  model: string;
  instructions: string;
  tools?: Record<string, unknown>;
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface PrepareCallResult {
  model?: string;
  instructions?: string;
  tools?: Record<string, unknown>;
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
  providerOptions?: Record<string, unknown>;
}

export type PrepareCall<TOptions extends Record<string, unknown>> = (
  context: PrepareCallContext<TOptions>,
) => PrepareCallResult | Promise<PrepareCallResult>;

export interface AgentWithCallOptions<TOptions extends Record<string, unknown> = Record<string, unknown>> {
  callOptionsSchema: ReturnType<typeof callOptionsSchema>;
  prepareCall: PrepareCall<TOptions>;
}

export function prepareCall<TOptions extends Record<string, unknown>>(
  fn: PrepareCall<TOptions>,
): PrepareCall<TOptions> {
  return fn;
}

export function createAgentWithCallOptions<TOptions extends Record<string, unknown>>(
  schema: CallOptionsSchema,
  prepare: PrepareCall<TOptions>,
): AgentWithCallOptions<TOptions> {
  return {
    callOptionsSchema: callOptionsSchema(schema),
    prepareCall: prepare,
  };
}
