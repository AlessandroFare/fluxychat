/**
 * P22-F7: Emoji System for Worker
 * Adapted from Vercel Chat SDK's emoji.ts.
 *
 * Features:
 * - Singleton EmojiValue objects with object identity
 * - Platform-specific emoji maps (slack, gchat, web)
 * - Custom emoji support
 * - Emoji resolution for different platforms
 */

// =============================================================================
// EmojiValue - Immutable singleton emoji objects with object identity
// =============================================================================

/** Internal emoji registry for singleton instances */
const emojiRegistry = new Map();

/**
 * Get or create an immutable singleton EmojiValue.
 * @param {string} name
 */
export function getEmoji(name) {
  let emojiValue = emojiRegistry.get(name);
  if (!emojiValue) {
    emojiValue = Object.freeze({
      name,
      toString: () => `{{emoji:${name}}}`,
      toJSON: () => `{{emoji:${name}}}`,
    });
    emojiRegistry.set(name, emojiValue);
  }
  return emojiValue;
}

// =============================================================================
// Emoji Map - Platform-specific formats
// =============================================================================

/**
 * Default emoji map for well-known emoji.
 * Maps normalized emoji names to platform-specific formats.
 */
export const DEFAULT_EMOJI_MAP = {
  thumbs_up: { slack: ["+1", "thumbsup"], gchat: "👍", web: "👍", unicode: "👍" },
  thumbs_down: { slack: ["-1", "thumbsdown"], gchat: "👎", web: "👎", unicode: "👎" },
  clap: { slack: "clap", gchat: "👏", web: "👏", unicode: "👏" },
  wave: { slack: "wave", gchat: "👋", web: "👋", unicode: "👋" },
  pray: { slack: "pray", gchat: "🙏", web: "🙏", unicode: "🙏" },
  muscle: { slack: "muscle", gchat: "💪", web: "💪", unicode: "💪" },
  ok_hand: { slack: "ok_hand", gchat: "👌", web: "👌", unicode: "👌" },
  heart: { slack: "heart", gchat: "❤️", web: "❤️", unicode: "❤️" },
  smile: { slack: ["smile", "slightly_smiling_face"], gchat: "😊", web: "😊", unicode: "😊" },
  laugh: { slack: ["laughing", "satisfied", "joy"], gchat: ["😂", "😆"], web: "😂", unicode: "😂" },
  thinking: { slack: "thinking_face", gchat: "🤔", web: "🤔", unicode: "🤔" },
  sad: { slack: ["cry", "sad"], gchat: "😢", web: "😢", unicode: "😢" },
  cry: { slack: "sob", gchat: "😭", web: "😭", unicode: "😭" },
  angry: { slack: "angry", gchat: "😠", web: "😠", unicode: "😠" },
  fire: { slack: "fire", gchat: "🔥", web: "🔥", unicode: "🔥" },
  rocket: { slack: "rocket", gchat: "🚀", web: "🚀", unicode: "🚀" },
  star: { slack: "star", gchat: "⭐", web: "⭐", unicode: "⭐" },
  check: { slack: "white_check_mark", gchat: "✅", web: "✅", unicode: "✅" },
  cross: { slack: "x", gchat: "❌", web: "❌", unicode: "❌" },
  eyes: { slack: "eyes", gchat: "👀", web: "👀", unicode: "👀" },
  party: { slack: "tada", gchat: "🎉", web: "🎉", unicode: "🎉" },
  sparkles: { slack: "sparkles", gchat: "✨", web: "✨", unicode: "✨" },
  bulb: { slack: "bulb", gchat: "💡", web: "💡", unicode: "💡" },
  link: { slack: "link", gchat: "🔗", web: "🔗", unicode: "🔗" },
  pin: { slack: "pushpin", gchat: "📌", web: "📌", unicode: "📌" },
  paperclip: { slack: "paperclip", gchat: "📎", web: "📎", unicode: "📎" },
  gear: { slack: "gear", gchat: "⚙️", web: "⚙️", unicode: "⚙️" },
  wrench: { slack: "wrench", gchat: "🔧", web: "🔧", unicode: "🔧" },
  bug: { slack: "bug", gchat: "🐛", web: "🐛", unicode: "🐛" },
  warning: { slack: "warning", gchat: "⚠️", web: "⚠️", unicode: "⚠️" },
  question: { slack: "question", gchat: "❓", web: "❓", unicode: "❓" },
  exclamation: { slack: "exclamation", gchat: "❗", web: "❗", unicode: "❗" },
};

// =============================================================================
// Emoji Resolution
// =============================================================================

/**
 * Resolve an emoji name to platform-specific format.
 * @param {string} name
 * @param {"slack" | "gchat" | "web"} platform
 */
export function resolveEmoji(name, platform = "web") {
  const formats = DEFAULT_EMOJI_MAP[name];
  if (!formats) return name;

  const platformFormats = formats[platform];
  if (!platformFormats) {
    return formats.web || formats.unicode || name;
  }

  if (Array.isArray(platformFormats)) {
    return platformFormats[0];
  }

  return platformFormats;
}

/**
 * Get all emoji names in a category.
 * @param {"reactions" | "status" | "actions" | "all"} category
 */
export function getEmojiNames(category = "all") {
  if (category === "all") {
    return Object.keys(DEFAULT_EMOJI_MAP);
  }
  const categoryEmojis = EMOJI_CATEGORIES[category] || [];
  return categoryEmojis
    .map((unicode) => {
      const entry = Object.entries(DEFAULT_EMOJI_MAP).find(
        ([, formats]) => formats.unicode === unicode || formats.web === unicode
      );
      return entry ? entry[0] : null;
    })
    .filter(Boolean);
}

// =============================================================================
// Emoji Categories (backward compatible)
// =============================================================================

export const EMOJI_CATEGORIES = {
  reactions: ["👍", "👎", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🤔", "👀"],
  status: ["✅", "❌", "⏳", "🔄", "🚀", "💡", "⭐", "🔗", "📎", "📌"],
  actions: ["👋", "🙏", "💪", "🤝", "👏", "🎯", "📊", "📈", "🔧", "⚙️"],
};

const EMOJI_PATTERN = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;

export function normalizeEmoji(emoji) {
  return (emoji || "").trim();
}

export function isValidEmoji(emoji) {
  const normalized = normalizeEmoji(emoji);
  if (!normalized) return false;
  return EMOJI_PATTERN.test(normalized);
}

export function getEmojiCategory(emoji) {
  for (const [category, emojis] of Object.entries(EMOJI_CATEGORIES)) {
    if (emojis.includes(emoji)) return category;
  }
  return null;
}
