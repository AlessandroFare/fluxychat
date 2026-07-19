export interface QaScore {
  label: string;
  score: number;
  confidence: number;
  evidenceSpans: EvidenceSpan[];
}

export interface EvidenceSpan {
  startMs: number;
  endMs: number;
  text: string;
  label: string;
}

export interface HumanReview {
  reviewerId: string;
  status: "pending" | "approved" | "rejected" | "revised";
  notes: string;
  correctedScores?: QaScore[];
  reviewedAt?: string;
}

export interface CallQaResult {
  callId: string;
  topics: QaScore[];
  outcomes: QaScore[];
  sentiment: QaScore;
  complianceScores: QaScore[];
  overallScore: number;
  humanReview: HumanReview | null;
}

export interface QaConfig {
  minEvidenceLengthMs: number;
  maxTopicLabels: number;
  complianceRules: string[];
  requireHumanReview: boolean;
}

export interface QaAnalyzer {
  analyzeCall(callId: string, segments: TranscriptSegment[]): CallQaResult;
  submitReview(callId: string, review: Omit<HumanReview, "reviewedAt">): void;
  getResult(callId: string): CallQaResult | null;
  updateScores(callId: string, scores: Partial<Pick<CallQaResult, "topics" | "outcomes" | "complianceScores">>): void;
  listResults(): CallQaResult[];
}

export interface TranscriptSegment {
  speakerId: string;
  startMs: number;
  endMs: number;
  text: string;
}

const DEFAULT_QA_CONFIG: QaConfig = {
  minEvidenceLengthMs: 200,
  maxTopicLabels: 10,
  complianceRules: ["gdpr", "hipaa", "pci"],
  requireHumanReview: false,
};

function computeOverallScore(result: CallQaResult): number {
  const scores = [
    result.sentiment.score / 100,
    ...result.topics.map((t) => t.score / 100),
    ...result.outcomes.map((o) => o.score / 100),
    ...result.complianceScores.map((c) => c.score / 100),
  ];
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
}

function extractEvidence(segments: TranscriptSegment[], label: string, config: QaConfig): EvidenceSpan[] {
  return segments
    .filter((s) => s.endMs - s.startMs >= config.minEvidenceLengthMs)
    .map((s) => ({
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      label,
    }));
}

export function createQaAnalyzer(config: Partial<QaConfig> = {}): QaAnalyzer {
  const cfg: QaConfig = { ...DEFAULT_QA_CONFIG, ...config };
  const results = new Map<string, CallQaResult>();

  return {
    analyzeCall(callId: string, segments: TranscriptSegment[]): CallQaResult {
      const topics: QaScore[] = [
        {
          label: "greeting",
          score: Math.round(Math.random() * 40 + 60),
          confidence: 0.85,
          evidenceSpans: extractEvidence(segments, "greeting", cfg).slice(0, 2),
        },
        {
          label: "issue_description",
          score: Math.round(Math.random() * 30 + 70),
          confidence: 0.9,
          evidenceSpans: extractEvidence(segments, "issue_description", cfg).slice(0, 3),
        },
      ];

      const outcomes: QaScore[] = [
        {
          label: "resolution",
          score: Math.round(Math.random() * 50 + 50),
          confidence: 0.75,
          evidenceSpans: extractEvidence(segments, "resolution", cfg).slice(0, 2),
        },
        {
          label: "follow_up",
          score: Math.round(Math.random() * 40 + 30),
          confidence: 0.65,
          evidenceSpans: [],
        },
      ];

      const sentiment: QaScore = {
        label: "customer_sentiment",
        score: Math.round(Math.random() * 60 + 20),
        confidence: 0.8,
        evidenceSpans: extractEvidence(segments, "sentiment", cfg).slice(0, 3),
      };

      const complianceScores: QaScore[] = cfg.complianceRules.map((rule) => ({
        label: rule,
        score: Math.round(Math.random() * 30 + 70),
        confidence: 0.7,
        evidenceSpans: [],
      }));

      const result: CallQaResult = {
        callId,
        topics,
        outcomes,
        sentiment,
        complianceScores,
        overallScore: 0,
        humanReview: cfg.requireHumanReview ? { reviewerId: "", status: "pending", notes: "" } : null,
      };
      result.overallScore = computeOverallScore(result);

      results.set(callId, result);
      return result;
    },

    submitReview(callId: string, review: Omit<HumanReview, "reviewedAt">): void {
      const result = results.get(callId);
      if (!result) throw new Error(`Call ${callId} not found.`);
      result.humanReview = { ...review, reviewedAt: new Date().toISOString() };
      if (review.correctedScores) {
        for (const corrected of review.correctedScores) {
          if (corrected.label === "customer_sentiment") {
            result.sentiment = corrected;
          } else if (result.topics.some((t) => t.label === corrected.label)) {
            result.topics = result.topics.map((t) => (t.label === corrected.label ? corrected : t));
          } else if (result.outcomes.some((o) => o.label === corrected.label)) {
            result.outcomes = result.outcomes.map((o) => (o.label === corrected.label ? corrected : o));
          }
        }
        result.overallScore = computeOverallScore(result);
      }
    },

    getResult(callId: string): CallQaResult | null {
      return results.get(callId) ?? null;
    },

    updateScores(callId: string, scores: Partial<Pick<CallQaResult, "topics" | "outcomes" | "complianceScores">>): void {
      const result = results.get(callId);
      if (!result) throw new Error(`Call ${callId} not found.`);
      if (scores.topics) result.topics = scores.topics;
      if (scores.outcomes) result.outcomes = scores.outcomes;
      if (scores.complianceScores) result.complianceScores = scores.complianceScores;
      result.overallScore = computeOverallScore(result);
    },

    listResults(): CallQaResult[] {
      return [...results.values()];
    },
  };
}
