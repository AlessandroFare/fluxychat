import { describe, it, expect } from "vitest";
import { createConversationAnalytics } from "./conversation-analytics";

describe("createConversationAnalytics", () => {
  it("analyzeSentiment returns positive for positive words", () => {
    const ca = createConversationAnalytics();
    const result = ca.analyzeSentiment("this is great and awesome");
    expect(result.label).toBe("positive");
  });

  it("analyzeSentiment returns negative for negative words", () => {
    const ca = createConversationAnalytics();
    const result = ca.analyzeSentiment("this is terrible and broken");
    expect(result.label).toBe("negative");
  });

  it("analyzeSentiment returns neutral for neutral text", () => {
    const ca = createConversationAnalytics();
    const result = ca.analyzeSentiment("the sky is blue");
    expect(result.label).toBe("neutral");
  });

  it("extractIntent detects greeting", () => {
    const ca = createConversationAnalytics();
    const result = ca.extractIntent("hello there");
    expect(result.intent).toBe("greeting");
  });

  it("extractIntent detects complaint", () => {
    const ca = createConversationAnalytics();
    const result = ca.extractIntent("got a problem with this");
    expect(result.intent).toBe("complaint");
  });

  it("extractIntent returns unknown for no match", () => {
    const ca = createConversationAnalytics();
    const result = ca.extractIntent("quantum entanglement");
    expect(result.intent).toBe("unknown");
  });

  it("clusterTopics groups related messages", () => {
    const ca = createConversationAnalytics();
    const topics = ca.clusterTopics([
      "the server is down again",
      "server outage affecting users",
      "when will server be back",
    ]);
    expect(topics.length).toBeGreaterThanOrEqual(1);
  });

  it("identifyKnowledgeGaps finds unanswered questions", () => {
    const ca = createConversationAnalytics();
    const gaps = ca.identifyKnowledgeGaps([
      { text: "how do I reset my password?", answered: false },
      { text: "what is the API rate limit?", answered: false },
      { text: "thanks for your help", answered: true },
    ]);
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(gaps[0].unansweredCount).toBeGreaterThan(0);
  });

  it("getAggregatedStats returns distribution", () => {
    const ca = createConversationAnalytics();
    ca.analyzeSentiment("great job");
    ca.analyzeSentiment("terrible experience");
    ca.analyzeSentiment("okay");
    const stats = ca.getAggregatedStats();
    expect(stats.totalMessages).toBe(3);
    expect(stats.sentimentDistribution.positive).toBe(1);
    expect(stats.sentimentDistribution.negative).toBe(1);
    expect(stats.sentimentDistribution.neutral).toBe(1);
  });
});
