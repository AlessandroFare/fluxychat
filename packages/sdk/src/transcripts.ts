/**
 * P22-F1: Transcripts API Types
 */

export type TranscriptRole = 'user' | 'assistant' | 'system';

export interface TranscriptEntry {
  /** UUID assigned at append time */
  id: string;
  /** Cross-platform user key */
  userKey: string;
  role: TranscriptRole;
  /** Plain-text body */
  text: string;
  /** Originating adapter name */
  platform: string;
  /** Originating thread ID */
  threadId: string;
  /** ms-since-epoch */
  timestamp: number;
  /** Platform-native message ID */
  platformMessageId?: string;
}

export interface AppendInput {
  text: string;
  role: TranscriptRole;
  platformMessageId?: string;
}

export interface AppendOptions {
  /** Required when appending AppendInput */
  userKey: string;
}

export interface ListQuery {
  userKey: string;
  /** Filter by platform */
  platforms?: string[];
  /** Filter by thread */
  threadId?: string;
  /** Filter by role */
  roles?: TranscriptRole[];
  /** Max entries to return (default: 50) */
  limit?: number;
}

export interface DeleteTarget {
  userKey: string;
}

export interface TranscriptsApi {
  append(thread: any, message: any, options?: AppendOptions): Promise<TranscriptEntry | null>;
  list(query: ListQuery): Promise<TranscriptEntry[]>;
  count(query: { userKey: string }): Promise<number>;
  delete(target: DeleteTarget): Promise<{ deleted: number }>;
}
