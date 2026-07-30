export interface ConversationSummary {
  summaryId: string;
  roomId: string;
  periodStart: string;
  periodEnd: string;
  title: string;
  keyPoints: string[];
  participantSummary: string;
  actionItems: string[];
  messageCount: number;
  generatedBy: string;
  model?: string;
  provenance?: { inputMessageIds: string[]; generatedAt: string };
}

export interface SummaryStore {
  save(summary: ConversationSummary): Promise<void>;
  get(summaryId: string): Promise<ConversationSummary | null>;
  list(roomId: string, limit?: number): Promise<ConversationSummary[]>;
  delete(summaryId: string): Promise<void>;
}

export function createMemorySummaryStore(): SummaryStore {
  const summaries = new Map<string, ConversationSummary>();
  return {
    async save(s) { summaries.set(s.summaryId, s); },
    async get(id) { return summaries.get(id) ?? null; },
    async list(roomId, limit = 20) {
      return [...summaries.values()].filter((s) => s.roomId === roomId).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, limit);
    },
    async delete(id) { summaries.delete(id); },
  };
}

export interface SearchResult {
  messageId: string;
  roomId: string;
  content: string;
  userId: string;
  score: number;
  matchedAt: string;
  snippet?: string;
}

export interface SearchIndex {
  index(roomId: string, messageId: string, content: string, userId: string, createdAt: string): Promise<void>;
  search(roomId: string, query: string, limit?: number): Promise<SearchResult[]>;
  remove(messageId: string): Promise<void>;
}

export function createMemorySearchIndex(): SearchIndex {
  const index = new Map<string, { roomId: string; messageId: string; content: string; userId: string; createdAt: string }>();

  function tokenize(text: string): string[] {
    return text.toLowerCase().split(/[^\w]+/).filter(Boolean);
  }

  return {
    async index(roomId, messageId, content, userId, createdAt) {
      index.set(messageId, { roomId, messageId, content, userId, createdAt });
    },
    async search(roomId, query, limit = 20) {
      const queryTokens = tokenize(query);
      const results: SearchResult[] = [];
      for (const entry of index.values()) {
        if (entry.roomId !== roomId) continue;
        const contentTokens = tokenize(entry.content);
        let score = 0;
        for (const qt of queryTokens) {
          for (const ct of contentTokens) {
            if (ct.startsWith(qt)) score += 1;
            if (ct === qt) score += 2;
          }
        }
        if (score > 0) {
          const snippet = entry.content.length > 150 ? entry.content.slice(0, 150) + "..." : entry.content;
          results.push({ messageId: entry.messageId, roomId, content: entry.content, userId: entry.userId, score, matchedAt: entry.createdAt, snippet });
        }
      }
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
    async remove(messageId) { index.delete(messageId); },
  };
}

export type ModerationAction = "allow" | "flag" | "block" | "review";

export interface ModerationResult {
  action: ModerationAction;
  label: string;
  confidence: number;
  details?: string;
  policyBreach?: string[];
}

export interface ModerationRule {
  name: string;
  patterns: RegExp[];
  action: ModerationAction;
  label: string;
}

export interface ModerationConfig {
  rules: ModerationRule[];
  dlpEnabled?: boolean;
  dlpPatterns?: RegExp[];
  logFlags?: boolean;
}

export interface ModerationReport {
  messageId: string;
  roomId: string;
  userId: string;
  results: ModerationResult[];
  timestamp: string;
}

export function createModerationEngine(config: ModerationConfig) {
  const { rules, dlpEnabled = true, dlpPatterns = [], logFlags = true } = config;
  const reports: ModerationReport[] = [];
  const defaultDlpPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, /\b\d{16}\b/, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  ];
  const effectiveDlpPatterns = dlpPatterns.length > 0 ? dlpPatterns : defaultDlpPatterns;

  return {
    check(content: string, meta: { messageId: string; roomId: string; userId: string }): ModerationResult[] {
      const results: ModerationResult[] = [];

      for (const rule of rules) {
        for (const pattern of rule.patterns) {
          if (pattern.test(content)) {
            results.push({ action: rule.action, label: rule.label, confidence: 1, policyBreach: [rule.name] });
            break;
          }
        }
      }

      if (dlpEnabled) {
        for (const pattern of effectiveDlpPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            results.push({ action: "flag", label: "PII detected", confidence: 0.9, details: `Matched ${matches.length} pattern(s)` });
            break;
          }
        }
      }

      if (results.length === 0) {
        results.push({ action: "allow", label: "clean", confidence: 1 });
      }

      if (logFlags) {
        reports.push({ messageId: meta.messageId, roomId: meta.roomId, userId: meta.userId, results, timestamp: new Date().toISOString() });
      }
      return results;
    },
    getReports(roomId?: string): ModerationReport[] {
      return roomId ? reports.filter((r) => r.roomId === roomId) : [...reports];
    },
    addRule(rule: ModerationRule) { rules.push(rule); },
    clearReports() { reports.length = 0; },
  };
}

export interface TranslationResult {
  messageId: string;
  sourceLang: string;
  targetLang: string;
  originalText: string;
  translatedText: string;
  confidence: number;
  timestamp: string;
}

export interface TranslationCache {
  get(text: string, sourceLang: string, targetLang: string): Promise<string | null>;
  set(text: string, sourceLang: string, targetLang: string, translation: string): Promise<void>;
}

export function createMemoryTranslationCache(): TranslationCache {
  const cache = new Map<string, string>();
  function key(text: string, source: string, target: string) {
    return `${source}:${target}:${text.slice(0, 100)}`;
  }
  return {
    async get(text, source, target) { return cache.get(key(text, source, target)) ?? null; },
    async set(text, source, target, translation) { cache.set(key(text, source, target), translation); },
  };
}
