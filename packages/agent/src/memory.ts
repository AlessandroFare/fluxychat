import type { AITool, AIToolContext } from "./agent-loop";
import type { AIEmbeddingModel } from "./providers";
import { embed } from "./retrieval";

export interface AIMemoryEntry {
  id: string;
  userId?: string;
  sessionId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface AIMemoryQuery {
  text: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  limit?: number;
  minScore?: number;
}

export interface AIMemoryStore {
  save(entry: Omit<AIMemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<AIMemoryEntry>;
  search(query: AIMemoryQuery): Promise<AIMemoryEntry[]>;
  get(id: string): Promise<AIMemoryEntry | null>;
  list(options?: { userId?: string; sessionId?: string; tags?: string[]; limit?: number }): Promise<AIMemoryEntry[]>;
  delete(id: string): Promise<boolean>;
  clear(userId?: string): Promise<void>;
  close?(): Promise<void>;
}

export interface AIMemoryConfig {
  store: AIMemoryStore;
  embeddingModel?: AIEmbeddingModel;
  defaultUserId?: string;
  defaultSessionId?: string;
  autoUserId?: boolean;
}

let memoryIdCounter = 0;
function nextMemoryId(): string {
  memoryIdCounter += 1;
  return `mem_${Date.now()}_${memoryIdCounter}_${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
}

export class InMemoryMemoryStore implements AIMemoryStore {
  private entries = new Map<string, AIMemoryEntry>();

  async save(entry: Omit<AIMemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<AIMemoryEntry> {
    const now = new Date().toISOString();
    const record: AIMemoryEntry = { ...entry, id: nextMemoryId(), createdAt: now, updatedAt: now };
    this.entries.set(record.id, record);
    return record;
  }

  async search(query: AIMemoryQuery): Promise<AIMemoryEntry[]> {
    let results = [...this.entries.values()];
    if (query.userId) results = results.filter((e) => e.userId === query.userId);
    if (query.sessionId) results = results.filter((e) => e.sessionId === query.sessionId);
    if (query.tags?.length) results = results.filter((e) => query.tags!.some((t) => e.tags?.includes(t)));
    const queryLower = query.text.toLowerCase();
    const scored = results
      .map((entry) => {
        const contentScore = entry.content.toLowerCase().includes(queryLower) ? 1 : 0;
        const tagScore = entry.tags?.some((t) => t.toLowerCase().includes(queryLower)) ? 0.5 : 0;
        const score = contentScore + tagScore;
        return { entry, score };
      })
      .filter(({ score }) => score >= (query.minScore ?? 0.1))
      .sort((a, b) => b.score - a.score);
    const limit = Math.max(1, query.limit ?? 10);
    return scored.slice(0, limit).map(({ entry }) => entry);
  }

  async get(id: string): Promise<AIMemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async list(options?: { userId?: string; sessionId?: string; tags?: string[]; limit?: number }): Promise<AIMemoryEntry[]> {
    let results = [...this.entries.values()];
    if (options?.userId) results = results.filter((e) => e.userId === options.userId);
    if (options?.sessionId) results = results.filter((e) => e.sessionId === options.sessionId);
    if (options?.tags?.length) results = results.filter((e) => options.tags!.some((t) => e.tags?.includes(t)));
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = Math.max(1, options?.limit ?? 50);
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async clear(userId?: string): Promise<void> {
    if (userId) {
      for (const [id, entry] of this.entries) {
        if (entry.userId === userId) this.entries.delete(id);
      }
    } else {
      this.entries.clear();
    }
  }
}

export interface FileMemoryStoreOptions {
  filePath: string;
  autoSave?: boolean;
}

export class FileMemoryStore implements AIMemoryStore {
  private entries = new Map<string, AIMemoryEntry>();
  private readonly filePath: string;
  private readonly autoSave: boolean;
  private loaded = false;

  constructor(options: FileMemoryStoreOptions) {
    this.filePath = options.filePath;
    this.autoSave = options.autoSave ?? true;
  }

  private fsModule: any = undefined;

  private async getFs(): Promise<any> {
    if (this.fsModule !== undefined) return this.fsModule;
    try {
      const proc = (globalThis as any).process;
      if (!proc || typeof proc !== "object") { this.fsModule = null; return null; }
      if (!proc?.versions?.node) { this.fsModule = null; return null; }
      // @ts-ignore - dynamic import avoids @types/node requirement
      this.fsModule = await import("fs");
      return this.fsModule;
    } catch {
      this.fsModule = null;
      return null;
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const fs = await this.getFs();
      if (fs && fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as AIMemoryEntry[];
        for (const entry of data) this.entries.set(entry.id, entry);
      }
    } catch {
      /* ignore load errors - start fresh */
    }
  }

  private async persist(): Promise<void> {
    if (!this.autoSave) return;
    try {
      const fs = await this.getFs();
      if (fs) {
        const dir = this.filePath.split(/[/\\]/).slice(0, -1).join("/");
        if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify([...this.entries.values()], null, 2), "utf-8");
      }
    } catch {
      /* ignore persist errors */
    }
  }

  async save(entry: Omit<AIMemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<AIMemoryEntry> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const record: AIMemoryEntry = { ...entry, id: nextMemoryId(), createdAt: now, updatedAt: now };
    this.entries.set(record.id, record);
    await this.persist();
    return record;
  }

  async search(query: AIMemoryQuery): Promise<AIMemoryEntry[]> {
    await this.ensureLoaded();
    let results = [...this.entries.values()];
    if (query.userId) results = results.filter((e) => e.userId === query.userId);
    if (query.sessionId) results = results.filter((e) => e.sessionId === query.sessionId);
    if (query.tags?.length) results = results.filter((e) => query.tags!.some((t) => e.tags?.includes(t)));
    const queryLower = query.text.toLowerCase();
    const scored = results
      .map((entry) => {
        const contentScore = entry.content.toLowerCase().includes(queryLower) ? 1 : 0;
        const tagScore = entry.tags?.some((t) => t.toLowerCase().includes(queryLower)) ? 0.5 : 0;
        return { entry, score: contentScore + tagScore };
      })
      .filter(({ score }) => score >= (query.minScore ?? 0.1))
      .sort((a, b) => b.score - a.score);
    const limit = Math.max(1, query.limit ?? 10);
    return scored.slice(0, limit).map(({ entry }) => entry);
  }

  async get(id: string): Promise<AIMemoryEntry | null> {
    await this.ensureLoaded();
    return this.entries.get(id) ?? null;
  }

  async list(options?: { userId?: string; sessionId?: string; tags?: string[]; limit?: number }): Promise<AIMemoryEntry[]> {
    await this.ensureLoaded();
    let results = [...this.entries.values()];
    if (options?.userId) results = results.filter((e) => e.userId === options.userId);
    if (options?.sessionId) results = results.filter((e) => e.sessionId === options.sessionId);
    if (options?.tags?.length) results = results.filter((e) => options.tags!.some((t) => e.tags?.includes(t)));
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = Math.max(1, options?.limit ?? 50);
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const existed = this.entries.has(id);
    if (existed) {
      this.entries.delete(id);
      await this.persist();
    }
    return existed;
  }

  async clear(userId?: string): Promise<void> {
    await this.ensureLoaded();
    if (userId) {
      for (const [id, entry] of this.entries) {
        if (entry.userId === userId) this.entries.delete(id);
      }
    } else {
      this.entries.clear();
    }
    await this.persist();
  }
}

export interface MemoryToolContext {
  store: AIMemoryStore;
  embeddingModel?: AIEmbeddingModel;
  userId?: string;
  sessionId?: string;
}

function resolveStore(ctx: AIToolContext<MemoryToolContext>, fallback: AIMemoryStore): AIMemoryStore {
  const tool = ctx.tool as MemoryToolContext | undefined;
  return tool?.store ?? fallback;
}

function resolveUserId(ctx: AIToolContext<MemoryToolContext>, fallback?: string): string | undefined {
  const tool = ctx.tool as MemoryToolContext | undefined;
  return tool?.userId ?? fallback;
}

function resolveSessionId(ctx: AIToolContext<MemoryToolContext>, fallback?: string): string | undefined {
  const tool = ctx.tool as MemoryToolContext | undefined;
  return tool?.sessionId ?? fallback;
}

export interface CreateMemoryToolsOptions {
  store: AIMemoryStore;
  embeddingModel?: AIEmbeddingModel;
  defaultUserId?: string;
  defaultSessionId?: string;
}

export function createMemoryTools(options: CreateMemoryToolsOptions): Record<string, AITool> {
  const { store, embeddingModel, defaultUserId, defaultSessionId } = options;

  return {
    remember: {
      description: "Remember a fact or information for future conversations. Use this to store user preferences, important details, or any information that should persist.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "The fact or information to remember" },
          tags: {
            type: "array", items: { type: "string" },
            description: "Optional tags to categorize the memory (e.g. ['preference', 'user-info'])",
          },
        },
        required: ["content"],
      },
      async execute(input: { content: string; tags?: string[] }, ctx: AIToolContext<MemoryToolContext>): Promise<string> {
        const activeStore = resolveStore(ctx, store);
        const userId = resolveUserId(ctx, defaultUserId);
        const sessionId = resolveSessionId(ctx, defaultSessionId);
        let embedding: number[] | undefined;
        if (embeddingModel) {
          try {
            const result = await embed(embeddingModel, input.content, { signal: ctx.signal });
            embedding = result.embedding;
          } catch {
            /* embedding is optional - continue without */
          }
        }
        const entry = await activeStore.save({
          content: input.content,
          tags: input.tags,
          userId,
          sessionId,
          role: "assistant",
          metadata: { source: "memory-tool" },
          embedding,
        });
        return `Remembered: "${input.content}" (id: ${entry.id})`;
      },
    },

    recall: {
      description: "Search past memories and information. Use this when you need to remember something the user told you in the past.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for in past memories" },
          limit: { type: "number", description: "Maximum results to return (default 5)" },
        },
        required: ["query"],
      },
      async execute(input: { query: string; limit?: number }, ctx: AIToolContext<MemoryToolContext>): Promise<string> {
        const activeStore = resolveStore(ctx, store);
        const userId = resolveUserId(ctx, defaultUserId);
        const sessionId = resolveSessionId(ctx, defaultSessionId);
        const results = await activeStore.search({
          text: input.query,
          userId,
          sessionId,
          limit: Math.max(1, Math.min(50, input.limit ?? 5)),
        });
        if (!results.length) return "No relevant memories found.";
        return results.map((entry, i) =>
          `${i + 1}. [${entry.createdAt}] ${entry.content}${entry.tags?.length ? ` (tags: ${entry.tags.join(", ")})` : ""}`
        ).join("\n");
      },
    },

    forget: {
      description: "Delete a specific memory by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The ID of the memory to delete" },
        },
        required: ["id"],
      },
      async execute(input: { id: string }, ctx: AIToolContext<MemoryToolContext>): Promise<string> {
        const activeStore = resolveStore(ctx, store);
        const deleted = await activeStore.delete(input.id);
        return deleted ? `Memory ${input.id} deleted.` : `Memory ${input.id} not found.`;
      },
    },

    listMemories: {
      description: "List recent memories. Optionally filter by tag.",
      inputSchema: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Optional tag to filter by" },
          limit: { type: "number", description: "Maximum memories to return (default 10)" },
        },
      },
      async execute(input: { tag?: string; limit?: number }, ctx: AIToolContext<MemoryToolContext>): Promise<string> {
        const activeStore = resolveStore(ctx, store);
        const userId = resolveUserId(ctx, defaultUserId);
        const sessionId = resolveSessionId(ctx, defaultSessionId);
        const entries = await activeStore.list({
          userId,
          sessionId,
          tags: input.tag ? [input.tag] : undefined,
          limit: Math.max(1, Math.min(100, input.limit ?? 10)),
        });
        if (!entries.length) return "No memories stored yet.";
        return entries.map((entry, i) =>
          `${i + 1}. [${entry.id}] ${entry.content}${entry.tags?.length ? ` (${entry.tags.join(", ")})` : ""}`
        ).join("\n");
      },
    },
  };
}

export const AUTO_MEMORY_SYSTEM_PROMPT = `You have memory tools available. Use them to remember information about the user and recall past conversations.

- Use "remember" to save important facts, preferences, and details the user shares.
- Use "recall" to search for past memories when the user asks about something you discussed before.
- Use "listMemories" to see what you know about the user.
- Use "forget" to delete specific memories.

Be proactive about saving information that will help you provide better assistance in the future.`;
