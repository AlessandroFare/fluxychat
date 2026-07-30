export type SentimentLabel = "positive" | "negative" | "neutral" | "mixed";

export interface SentimentResult {
  label: SentimentLabel;
  score: number;
  confidence: number;
  timestamp: number;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
}

export interface TopicCluster {
  id: string;
  name: string;
  keywords: string[];
  messageCount: number;
  lastMentioned: number;
}

export interface KnowledgeGap {
  topic: string;
  frequency: number;
  unansweredCount: number;
  suggestedSources: string[];
}

export interface ConversationAnalytics {
  analyzeSentiment(text: string): SentimentResult;
  extractIntent(text: string): IntentResult;
  clusterTopics(messages: string[]): TopicCluster[];
  identifyKnowledgeGaps(messages: Array<{ text: string; answered: boolean }>): KnowledgeGap[];
  getAggregatedStats(): {
    totalMessages: number;
    sentimentDistribution: Record<SentimentLabel, number>;
    topIntents: Array<{ intent: string; count: number }>;
    topTopics: TopicCluster[];
  };
}

export function createConversationAnalytics(): ConversationAnalytics {
  const messageLog: Array<{ text: string; sentiment: SentimentResult; intent: IntentResult }> = [];
  const topicClusters = new Map<string, TopicCluster>();
  let clusterCounter = 0;

  const POSITIVE_WORDS = ["good", "great", "awesome", "thanks", "love", "excellent", "amazing", "helpful", "perfect", "wonderful"];
  const NEGATIVE_WORDS = ["bad", "terrible", "awful", "hate", "worst", "broken", "useless", "horrible", "slow", "frustrating"];
  const INTENT_PATTERNS: Array<{ intent: string; keywords: string[] }> = [
    { intent: "greeting", keywords: ["hello", "hi", "hey", "good morning", "good evening"] },
    { intent: "farewell", keywords: ["bye", "goodbye", "see you", "later"] },
    { intent: "complaint", keywords: ["broken", "issue", "problem", "bug", "not working", "error"] },
    { intent: "request", keywords: ["please", "could you", "can you", "i need", "i want", "help"] },
    { intent: "feedback", keywords: ["feedback", "suggestion", "improve", "feature request"] },
  ];

  function computeSentiment(text: string): SentimentResult {
    const lower = text.toLowerCase();
    let score = 0;
    for (const w of POSITIVE_WORDS) if (lower.includes(w)) score += 0.15;
    for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score -= 0.15;
    const label: SentimentLabel = score > 0.1 ? "positive" : score < -0.1 ? "negative" : "neutral";
    return { label, score, confidence: Math.min(Math.abs(score) + 0.5, 0.99), timestamp: Date.now() };
  }

  function extractKeywords(text: string): string[] {
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "i", "you", "he", "she", "it", "we", "they", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "this", "that"]);
    return text.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !stopWords.has(w));
  }

  return {
    analyzeSentiment(text) {
      const result = computeSentiment(text);
      messageLog.push({ text, sentiment: result, intent: { intent: "unknown", confidence: 0, entities: {} } });
      return { ...result };
    },

    extractIntent(text) {
      const lower = text.toLowerCase();
      for (const pattern of INTENT_PATTERNS) {
        if (pattern.keywords.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower))) {
          const result: IntentResult = { intent: pattern.intent, confidence: 0.8, entities: {} };
          const lastEntry = messageLog[messageLog.length - 1];
          if (lastEntry) lastEntry.intent = result;
          return { ...result };
        }
      }
      return { intent: "unknown", confidence: 0.1, entities: {} };
    },

    clusterTopics(messages) {
      const topicKeywords = new Map<string, { keywords: Set<string>; count: number }>();
      for (const msg of messages) {
        const keywords = extractKeywords(msg);
        let matched = false;
        for (const [topicId, cluster] of topicKeywords) {
          const overlap = keywords.filter((k) => cluster.keywords.has(k)).length;
          if (overlap >= 2) {
            keywords.forEach((k) => cluster.keywords.add(k));
            cluster.count++;
            matched = true;
            break;
          }
        }
        if (!matched && keywords.length >= 2) {
          const id = `topic-${++clusterCounter}`;
          topicKeywords.set(id, { keywords: new Set(keywords), count: 1 });
        }
      }

      const clusters: TopicCluster[] = [];
      for (const [id, data] of topicKeywords) {
        clusters.push({
          id, name: Array.from(data.keywords).slice(0, 3).join(", "),
          keywords: Array.from(data.keywords),
          messageCount: data.count,
          lastMentioned: Date.now(),
        });
      }
      return clusters;
    },

    identifyKnowledgeGaps(messages) {
      const gapMap = new Map<string, { topic: string; frequency: number; unansweredCount: number }>();
      for (const msg of messages) {
        if (msg.text.toLowerCase().includes("how") || msg.text.toLowerCase().includes("what") || msg.text.toLowerCase().includes("why")) {
          const keywords = extractKeywords(msg.text);
          const topic = keywords.slice(0, 3).join(" ");
          if (!gapMap.has(topic)) {
            gapMap.set(topic, { topic, frequency: 0, unansweredCount: 0 });
          }
          const g = gapMap.get(topic)!;
          g.frequency++;
          if (!msg.answered) g.unansweredCount++;
        }
      }
      return Array.from(gapMap.values())
        .map((g) => ({ ...g, suggestedSources: [] }))
        .sort((a, b) => b.frequency - a.frequency);
    },

    getAggregatedStats() {
      const distribution: Record<SentimentLabel, number> = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      const intentCount = new Map<string, number>();
      for (const entry of messageLog) {
        distribution[entry.sentiment.label]++;
        intentCount.set(entry.intent.intent, (intentCount.get(entry.intent.intent) ?? 0) + 1);
      }
      return {
        totalMessages: messageLog.length,
        sentimentDistribution: { ...distribution },
        topIntents: Array.from(intentCount.entries())
          .map(([intent, count]) => ({ intent, count }))
          .sort((a, b) => b.count - a.count),
        topTopics: Array.from(topicClusters.values()),
      };
    },
  };
}
