/**
 * P24-13: Tool Call Annotations
 * Metadata on tool calls for UI rendering and debugging.
 */

export interface ToolCallAnnotation {
  /** Tool call ID */
  toolCallId: string;
  /** Annotation type */
  type: "status" | "progress" | "result" | "error" | "approval" | "display";
  /** Annotation content */
  content: string;
  /** For progress annotations: 0-100 */
  progress?: number;
  /** For display annotations: icon or image URL */
  icon?: string;
  /** For display annotations: title */
  title?: string;
  /** For display annotations: description */
  description?: string;
  /** Whether this annotation should be shown to the user */
  visible?: boolean;
  /** Timestamp */
  timestamp: number;
}

export interface ToolCallAnnotationStore {
  /** Add an annotation to a tool call */
  add(toolCallId: string, annotation: Omit<ToolCallAnnotation, "toolCallId" | "timestamp">): void;
  /** Get all annotations for a tool call */
  get(toolCallId: string): ToolCallAnnotation[];
  /** Get the latest annotation for a tool call */
  getLatest(toolCallId: string): ToolCallAnnotation | null;
  /** Clear annotations for a tool call */
  clear(toolCallId: string): void;
  /** Clear all annotations */
  clearAll(): void;
}

export function createToolCallAnnotationStore(): ToolCallAnnotationStore {
  throw new Error("createToolCallAnnotationStore not implemented in SDK - use worker runtime");
}

/**
 * Built-in annotation helpers.
 */
export function createStatusAnnotation(toolCallId: string, status: string): ToolCallAnnotation {
  throw new Error("createStatusAnnotation not implemented in SDK - use worker runtime");
}
export function createProgressAnnotation(toolCallId: string, progress: number, message?: string): ToolCallAnnotation {
  throw new Error("createProgressAnnotation not implemented in SDK - use worker runtime");
}
export function createResultAnnotation(toolCallId: string, summary: string): ToolCallAnnotation {
  throw new Error("createResultAnnotation not implemented in SDK - use worker runtime");
}
export function createErrorAnnotation(toolCallId: string, error: string): ToolCallAnnotation {
  throw new Error("createErrorAnnotation not implemented in SDK - use worker runtime");
}
