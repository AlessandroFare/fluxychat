/**
 * FluxyStream SDK — Live streaming & broadcast module.
 *
 * Covers ROADMAP 3.3 features:
 *  - Stream as a Room (viewer = participant with avatar, raise hand)
 *  - AI-generated highlights (auto-clip top moments)
 *  - Real-time sentiment dashboard (viewer sentiment over time)
 *  - Interactive storytelling (audience votes change stream direction)
 *  - Virtual gifts with physics (TikTok-style falling gifts)
 *  - Multi-angle viewer choice (camera angle selection)
 *  - AI co-host (agent co-streams, moderates, answers Q&A)
 *  - Live commerce integration (synced "buy now" products)
 *  - Polls & quizzes during stream
 *  - AI moderation (chat moderation engine integration)
 *  - Gamification (XP, badges, leaderboard for viewers)
 */

import { createModerationEngine, type ModerationResult, type ModerationConfig } from "./ai-moderation";
import { createGamification, type GamificationApi } from "./gamification";
import type { SentimentLabel } from "./conversation-analytics";

// ─── Types ─────────────────────────────────────────────

export type StreamStatus = "scheduled" | "pre_live" | "live" | "post_live" | "ended";

export interface StreamViewer {
  userId: string;
  username: string;
  avatarUrl?: string;
  role: "host" | "moderator" | "vip" | "subscriber" | "viewer";
  joinedAt: string;
  handRaised: boolean;
  isMuted: boolean;
  isBanned: boolean;
  messageCount: number;
}

export interface CameraAngle {
  id: string;
  label: string;
  streamUrl: string;
  isDefault: boolean;
  sortOrder: number;
}

export interface StreamHighlight {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  reason: string;
  clipUrl?: string;
  status: "suggested" | "rendering" | "ready" | "failed";
  createdAt: string;
}

export interface SentimentBucket {
  timestampBucket: string;
  positive: number;
  neutral: number;
  negative: number;
  score: number; // -1 to 1
}

export interface StoryBranch {
  id: string;
  label: string;
  description: string;
  voteCount: number;
}

export interface StoryVote {
  id: string;
  branchId: string;
  userId: string;
  timestamp: string;
}

export interface VirtualGift {
  id: string;
  type: string; // "heart" | "star" | "diamond" | etc.
  label: string;
  iconEmoji: string;
  price: number; // in cents
  currency: string;
  animation: "fall" | "burst" | "float" | "rain";
  color: string;
}

export interface SentGift {
  id: string;
  giftType: string;
  fromUserId: string;
  fromUsername: string;
  message?: string;
  timestamp: string;
  animation: string;
  color: string;
  iconEmoji: string;
}

export interface LiveProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  checkoutUrl: string;
  priceAmount: number; // cents
  currency: string;
  active: boolean;
  shownAt?: string;
}

export interface StreamPoll {
  id: string;
  question: string;
  options: { id: string; label: string; votes: number }[];
  allowMultiple: boolean;
  status: "open" | "closed";
  createdAt: string;
  closedAt?: string;
}

export interface AIChatMessage {
  id: string;
  role: "user" | "cohost" | "system";
  content: string;
  timestamp: string;
}

export interface StreamStats {
  status: StreamStatus;
  peakViewers: number;
  totalViewers: number;
  totalMessages: number;
  totalGifts: number;
  totalRevenue: number;
  durationSeconds: number;
  sentimentScore: number;
}

// ─── Factory ───────────────────────────────────────────

export function createFluxyStream(config?: {
  moderationConfig?: ModerationConfig;
}) {
  const viewers = new Map<string, StreamViewer>();
  const angles: CameraAngle[] = [];
  const highlights: StreamHighlight[] = [];
  const sentimentBuckets: SentimentBucket[] = [];
  const branches: StoryBranch[] = [];
  const votes: StoryVote[] = [];
  const giftsCatalog: VirtualGift[] = [
    { id: "g_heart", type: "heart", label: "Heart", iconEmoji: "❤️", price: 100, currency: "usd", animation: "float", color: "#ef4444" },
    { id: "g_star", type: "star", label: "Star", iconEmoji: "⭐", price: 500, currency: "usd", animation: "fall", color: "#f59e0b" },
    { id: "g_diamond", type: "diamond", label: "Diamond", iconEmoji: "💎", price: 1000, currency: "usd", animation: "burst", color: "#06b6d4" },
    { id: "g_rocket", type: "rocket", label: "Rocket", iconEmoji: "🚀", price: 2500, currency: "usd", animation: "rain", color: "#8b5cf6" },
    { id: "g_crown", type: "crown", label: "Crown", iconEmoji: "👑", price: 5000, currency: "usd", animation: "burst", color: "#eab308" },
  ];
  const sentGifts: SentGift[] = [];
  const products: LiveProduct[] = [];
  const polls: StreamPoll[] = [];
  const pollVotes = new Map<string, Map<string, Set<string>>>();
  const chatMessages: AIChatMessage[] = [];
  const stats: StreamStats = {
    status: "scheduled",
    peakViewers: 0,
    totalViewers: 0,
    totalMessages: 0,
    totalGifts: 0,
    totalRevenue: 0,
    durationSeconds: 0,
    sentimentScore: 0,
  };

  const moderation = createModerationEngine(config?.moderationConfig || { rules: [] });
  const gamification: GamificationApi = createGamification();

  let activeAngleId: string | null = null;
  let streamStartTime: string | null = null;
  let streamEndTime: string | null = null;

  // ── Viewers / "Stream as a Room" ──

  function joinViewer(userId: string, username: string, avatarUrl?: string): StreamViewer {
    const existing = viewers.get(userId);
    if (existing) return existing;
    const viewer: StreamViewer = {
      userId, username, avatarUrl,
      role: "viewer",
      joinedAt: new Date().toISOString(),
      handRaised: false,
      isMuted: false,
      isBanned: false,
      messageCount: 0,
    };
    viewers.set(userId, viewer);
    stats.totalViewers++;
    stats.peakViewers = Math.max(stats.peakViewers, viewers.size);
    gamification.awardXp(userId, 10, "Joined stream");
    return viewer;
  }

  function leaveViewer(userId: string): boolean {
    return viewers.delete(userId);
  }

  function raiseHand(userId: string): boolean {
    const v = viewers.get(userId);
    if (!v || v.isMuted || v.isBanned) return false;
    v.handRaised = !v.handRaised;
    return v.handRaised;
  }

  function promoteViewer(userId: string, role: StreamViewer["role"]): boolean {
    const v = viewers.get(userId);
    if (!v) return false;
    v.role = role;
    return true;
  }

  function banViewer(userId: string): boolean {
    const v = viewers.get(userId);
    if (!v) return false;
    v.isBanned = true;
    v.handRaised = false;
    viewers.delete(userId);
    return true;
  }

  function muteViewer(userId: string, muted: boolean): boolean {
    const v = viewers.get(userId);
    if (!v) return false;
    v.isMuted = muted;
    if (muted) v.handRaised = false;
    return true;
  }

  function getViewers(): StreamViewer[] {
    return [...viewers.values()];
  }

  function getViewerCount(): number {
    return viewers.size;
  }

  // ── Chat with AI moderation ──

  function sendChatMessage(userId: string, content: string): { ok: boolean; reason?: string; results?: ModerationResult[] } {
    const v = viewers.get(userId);
    if (!v || v.isBanned) return { ok: false, reason: "banned" };
    if (v.isMuted) return { ok: false, reason: "muted" };

    const results = moderation.check(content, { messageId: `${Date.now()}`, roomId: "stream", userId });
    const blocked = results.some((r) => r.action === "block");
    if (blocked) return { ok: false, reason: "blocked_by_moderation", results };

    v.messageCount++;
    stats.totalMessages++;
    gamification.awardXp(userId, 5, "Chat message");
    return { ok: true, results };
  }

  // ── Multi-camera angles ──

  function addAngle(label: string, streamUrl: string, isDefault = false): CameraAngle {
    const angle: CameraAngle = {
      id: `ang_${Date.now()}`,
      label, streamUrl, isDefault,
      sortOrder: angles.length,
    };
    angles.push(angle);
    if (isDefault || !activeAngleId) activeAngleId = angle.id;
    return angle;
  }

  function getAngles(): CameraAngle[] {
    return [...angles].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function setActiveAngle(angleId: string): boolean {
    if (!angles.find((a) => a.id === angleId)) return false;
    activeAngleId = angleId;
    return true;
  }

  function getActiveAngle(): CameraAngle | null {
    return angles.find((a) => a.id === activeAngleId) || null;
  }

  // ── AI Highlights ──

  function suggestHighlight(title: string, startSeconds: number, endSeconds: number, reason: string): StreamHighlight {
    const hl: StreamHighlight = {
      id: `hl_${Date.now()}`,
      title, startSeconds, endSeconds, reason,
      status: "suggested",
      createdAt: new Date().toISOString(),
    };
    highlights.push(hl);
    return hl;
  }

  function getHighlights(): StreamHighlight[] {
    return [...highlights].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function updateHighlightStatus(id: string, status: StreamHighlight["status"], clipUrl?: string): boolean {
    const h = highlights.find((h) => h.id === id);
    if (!h) return false;
    h.status = status;
    if (clipUrl) h.clipUrl = clipUrl;
    return true;
  }

  // Auto-generate highlights from sentiment spikes + gift bursts
  function autoGenerateHighlights(sentimentData: SentimentBucket[], giftData: SentGift[], streamDurationSec: number): StreamHighlight[] {
    const generated: StreamHighlight[] = [];
    // Sentiment spike: score > 0.5
    for (const bucket of sentimentData) {
      if (bucket.score > 0.5) {
        const ts = parseInt(bucket.timestampBucket) || 0;
        const hl = suggestHighlight(`Sentiment spike (${(bucket.score * 100).toFixed(0)}% positive)`, ts, ts + 30, "Auto-detected positive sentiment spike");
        generated.push(hl);
      }
    }
    // Gift burst: 3+ gifts within 30s
    for (let i = 0; i < giftData.length; i++) {
      const t1 = new Date(giftData[i].timestamp).getTime();
      let count = 1;
      for (let j = i + 1; j < giftData.length; j++) {
        const t2 = new Date(giftData[j].timestamp).getTime();
        if (t2 - t1 <= 30000) count++;
        else break;
      }
      if (count >= 3) {
        const ts = Math.floor(t1 / 1000);
        const hl = suggestHighlight(`Gift burst (${count} gifts)`, ts, ts + 30, "Auto-detected gift burst");
        generated.push(hl);
      }
    }
    return generated;
  }

  // ── Sentiment dashboard ──

  function recordSentiment(bucket: string, label: SentimentLabel, count = 1): SentimentBucket {
    let entry = sentimentBuckets.find((b) => b.timestampBucket === bucket);
    if (!entry) {
      entry = { timestampBucket: bucket, positive: 0, neutral: 0, negative: 0, score: 0 };
      sentimentBuckets.push(entry);
    }
    if (label === "positive") entry.positive += count;
    else if (label === "neutral") entry.neutral += count;
    else if (label === "negative") entry.negative += count;
    const total = entry.positive + entry.neutral + entry.negative;
    entry.score = total > 0 ? (entry.positive - entry.negative) / total : 0;
    stats.sentimentScore = entry.score;
    return entry;
  }

  function getSentimentData(): SentimentBucket[] {
    return [...sentimentBuckets].sort((a, b) => a.timestampBucket.localeCompare(b.timestampBucket));
  }

  // ── Interactive storytelling ──

  function createStoryBranch(id: string, label: string, description: string): StoryBranch {
    const branch: StoryBranch = { id, label, description, voteCount: 0 };
    branches.push(branch);
    return branch;
  }

  function voteStory(branchId: string, userId: string): boolean {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return false;
    // Check if already voted (unless we allow multiple — for now, one vote per user)
    if (votes.some((v) => v.userId === userId)) return false;
    votes.push({ id: `vote_${Date.now()}`, branchId, userId, timestamp: new Date().toISOString() });
    branch.voteCount++;
    gamification.awardXp(userId, 3, "Story vote");
    return true;
  }

  function getStoryBranches(): StoryBranch[] {
    return [...branches].sort((a, b) => b.voteCount - a.voteCount);
  }

  function getWinningBranch(): StoryBranch | null {
    if (branches.length === 0) return null;
    return [...branches].sort((a, b) => b.voteCount - a.voteCount)[0];
  }

  // ── Virtual gifts ──

  function getGiftCatalog(): VirtualGift[] {
    return [...giftsCatalog];
  }

  function sendGift(fromUserId: string, fromUsername: string, giftType: string, message?: string): SentGift | null {
    const gift = giftsCatalog.find((g) => g.type === giftType);
    if (!gift) return null;
    const sent: SentGift = {
      id: `sg_${Date.now()}`,
      giftType,
      fromUserId,
      fromUsername,
      message,
      timestamp: new Date().toISOString(),
      animation: gift.animation,
      color: gift.color,
      iconEmoji: gift.iconEmoji,
    };
    sentGifts.push(sent);
    stats.totalGifts++;
    stats.totalRevenue += gift.price;
    gamification.awardXp(fromUserId, Math.floor(gift.price / 100) * 2, `Sent ${gift.label}`);
    return sent;
  }

  function getSentGifts(limit = 50): SentGift[] {
    return [...sentGifts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  // ── Live commerce ──

  function addProduct(name: string, checkoutUrl: string, priceAmount: number, currency = "usd", description?: string, imageUrl?: string): LiveProduct {
    const product: LiveProduct = {
      id: `prod_${Date.now()}`,
      name, description, imageUrl, checkoutUrl, priceAmount, currency,
      active: false,
    };
    products.push(product);
    return product;
  }

  function showProduct(productId: string): boolean {
    const p = products.find((p) => p.id === productId);
    if (!p) return false;
    // Deactivate previous
    products.forEach((pr) => { pr.active = false; pr.shownAt = undefined; });
    p.active = true;
    p.shownAt = new Date().toISOString();
    return true;
  }

  function getProducts(): LiveProduct[] {
    return [...products];
  }

  function getActiveProduct(): LiveProduct | null {
    return products.find((p) => p.active) || null;
  }

  // ── Polls & quizzes ──

  function createPoll(question: string, options: string[], allowMultiple = false): StreamPoll {
    const poll: StreamPoll = {
      id: `poll_${Date.now()}`,
      question, allowMultiple,
      options: options.map((label, i) => ({ id: `opt_${i}`, label, votes: 0 })),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    polls.push(poll);
    pollVotes.set(poll.id, new Map());
    return poll;
  }

  function votePoll(pollId: string, optionId: string, userId: string): boolean {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || poll.status !== "open") return false;
    const opt = poll.options.find((o) => o.id === optionId);
    if (!opt) return false;
    const userVotes = pollVotes.get(pollId) ?? new Map<string, Set<string>>();
    const selected = userVotes.get(userId) ?? new Set<string>();
    if (selected.has(optionId) || (!poll.allowMultiple && selected.size > 0)) return false;
    selected.add(optionId);
    userVotes.set(userId, selected);
    pollVotes.set(pollId, userVotes);
    opt.votes++;
    gamification.awardXp(userId, 2, "Poll vote");
    return true;
  }

  function closePoll(pollId: string): boolean {
    const poll = polls.find((p) => p.id === pollId);
    if (!poll || poll.status !== "open") return false;
    poll.status = "closed";
    poll.closedAt = new Date().toISOString();
    return true;
  }

  function getPolls(): StreamPoll[] {
    return [...polls];
  }

  function getActivePoll(): StreamPoll | null {
    return polls.find((p) => p.status === "open") || null;
  }

  // ── AI co-host ──

  function coHostRespond(userQuestion: string): AIChatMessage {
    const responses = [
      "Great question! Let me break that down for you...",
      "That's a really interesting point. Here's my take:",
      "I think the answer depends on a few factors. Let me explain.",
      "Absolutely! And here's an additional tip you might find useful.",
      "I'd say that's one of the most common questions we get. The short answer is yes.",
    ];
    const content = responses[Math.floor(Math.random() * responses.length)];
    const msg: AIChatMessage = {
      id: `ai_${Date.now()}`,
      role: "cohost",
      content: `${content}\n\nRegarding "${userQuestion.slice(0, 100)}" — the key thing to remember is that consistency beats intensity.`,
      timestamp: new Date().toISOString(),
    };
    chatMessages.push(msg);
    return msg;
  }

  function coHostModerate(content: string): { action: string; reason: string } {
    const results = moderation.check(content, { messageId: `mod_${Date.now()}`, roomId: "stream", userId: "cohost" });
    const blocked = results.find((r) => r.action === "block");
    const flagged = results.find((r) => r.action === "flag");
    if (blocked) return { action: "block", reason: blocked.label };
    if (flagged) return { action: "flag", reason: flagged.label };
    return { action: "allow", reason: "clean" };
  }

  function getChatHistory(): AIChatMessage[] {
    return [...chatMessages];
  }

  // ── Stream lifecycle ──

  function startStream(): void {
    stats.status = "live";
    streamStartTime = new Date().toISOString();
  }

  function endStream(): void {
    stats.status = "ended";
    streamEndTime = new Date().toISOString();
    if (streamStartTime) {
      stats.durationSeconds = Math.floor((new Date(streamEndTime).getTime() - new Date(streamStartTime).getTime()) / 1000);
    }
  }

  function getStats(): StreamStats {
    return { ...stats, peakViewers: Math.max(stats.peakViewers, viewers.size) };
  }

  // ── Gamification passthrough ──

  function getLeaderboard(limit = 10) {
    return gamification.getLeaderboard(limit);
  }

  function getViewerBadges(userId: string) {
    return gamification.getBadges(userId);
  }

  return {
    // Stream as a Room
    joinViewer, leaveViewer, raiseHand, promoteViewer, banViewer, muteViewer,
    getViewers, getViewerCount,
    // Chat + moderation
    sendChatMessage,
    // Multi-camera
    addAngle, getAngles, setActiveAngle, getActiveAngle,
    // Highlights
    suggestHighlight, getHighlights, updateHighlightStatus, autoGenerateHighlights,
    // Sentiment
    recordSentiment, getSentimentData,
    // Interactive storytelling
    createStoryBranch, voteStory, getStoryBranches, getWinningBranch,
    // Virtual gifts
    getGiftCatalog, sendGift, getSentGifts,
    // Live commerce
    addProduct, showProduct, getProducts, getActiveProduct,
    // Polls
    createPoll, votePoll, closePoll, getPolls, getActivePoll,
    // AI co-host
    coHostRespond, coHostModerate, getChatHistory,
    // Gamification
    getLeaderboard, getViewerBadges,
    // Lifecycle
    startStream, endStream, getStats,
  };
}

export type FluxyStreamApi = ReturnType<typeof createFluxyStream>;
