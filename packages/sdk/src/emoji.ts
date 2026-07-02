/**
 * P22-F7: Emoji system for reactions and quick responses.
 * Adapted from Vercel Chat SDK's emoji.ts.
 *
 * Features:
 * - Singleton EmojiValue objects with object identity (=== comparison)
 * - Platform-specific emoji maps (slack, gchat, web)
 * - Custom emoji support
 * - Emoji resolution for different platforms
 */

// =============================================================================
// EmojiValue - Immutable singleton emoji objects with object identity
// =============================================================================

/** Internal emoji registry for singleton instances */
const emojiRegistry = new Map<string, EmojiValue>();

/**
 * Get or create an immutable singleton EmojiValue.
 *
 * Always returns the same frozen object for the same name,
 * enabling `===` comparison for emoji identity.
 *
 * @example
 * ```typescript
 * const e1 = getEmoji("thumbs_up");
 * const e2 = getEmoji("thumbs_up");
 * console.log(e1 === e2); // true - same object
 * ```
 */
export function getEmoji(name: string): EmojiValue {
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
 * Platform-specific emoji formats.
 */
export interface EmojiFormats {
  /** Slack emoji name(s) - can be array for multiple valid names */
  slack?: string | string[];
  /** Google Chat unicode emoji */
  gchat?: string | string[];
  /** Web unicode emoji */
  web?: string;
  /** Unicode emoji */
  unicode?: string;
}

/**
 * Default emoji map for well-known emoji.
 * Maps normalized emoji names to platform-specific formats.
 */
export const DEFAULT_EMOJI_MAP: Record<string, EmojiFormats> = {
  // Reactions & Gestures
  thumbs_up: { slack: ["+1", "thumbsup"], gchat: "👍", web: "👍", unicode: "👍" },
  thumbs_down: { slack: ["-1", "thumbsdown"], gchat: "👎", web: "👎", unicode: "👎" },
  clap: { slack: "clap", gchat: "👏", web: "👏", unicode: "👏" },
  wave: { slack: "wave", gchat: "👋", web: "👋", unicode: "👋" },
  pray: { slack: "pray", gchat: "🙏", web: "🙏", unicode: "🙏" },
  muscle: { slack: "muscle", gchat: "💪", web: "💪", unicode: "💪" },
  ok_hand: { slack: "ok_hand", gchat: "👌", web: "👌", unicode: "👌" },
  point_up: { slack: "point_up", gchat: "👆", web: "👆", unicode: "👆" },
  point_down: { slack: "point_down", gchat: "👇", web: "👇", unicode: "👇" },
  point_left: { slack: "point_left", gchat: "👈", web: "👈", unicode: "👈" },
  point_right: { slack: "point_right", gchat: "👉", web: "👉", unicode: "👉" },
  raised_hands: { slack: "raised_hands", gchat: "🙌", web: "🙌", unicode: "🙌" },
  shrug: { slack: "shrug", gchat: "🤷", web: "🤷", unicode: "🤷" },
  facepalm: { slack: "facepalm", gchat: "🤦", web: "🤦", unicode: "🤦" },

  // Emotions & Faces
  heart: { slack: "heart", gchat: ["❤️", "❤"], web: "❤️", unicode: "❤️" },
  smile: { slack: ["smile", "slightly_smiling_face"], gchat: "😊", web: "😊", unicode: "😊" },
  laugh: { slack: ["laughing", "satisfied", "joy"], gchat: ["😂", "😆"], web: "😂", unicode: "😂" },
  thinking: { slack: "thinking_face", gchat: "🤔", web: "🤔", unicode: "🤔" },
  sad: { slack: ["cry", "sad", "white_frowning_face"], gchat: "😢", web: "😢", unicode: "😢" },
  cry: { slack: "sob", gchat: "😭", web: "😭", unicode: "😭" },
  angry: { slack: "angry", gchat: "😠", web: "😠", unicode: "😠" },
  love_eyes: { slack: "heart_eyes", gchat: "😍", web: "😍", unicode: "😍" },
  cool: { slack: "sunglasses", gchat: "😎", web: "😎", unicode: "😎" },
  wink: { slack: "wink", gchat: "😉", web: "😉", unicode: "😉" },
  flushed: { slack: "flushed", gchat: "😳", web: "😳", unicode: "😳" },
  party: { slack: "tada", gchat: "🎉", web: "🎉", unicode: "🎉" },
  fire: { slack: "fire", gchat: "🔥", web: "🔥", unicode: "🔥" },
  rocket: { slack: "rocket", gchat: "🚀", web: "🚀", unicode: "🚀" },
  star: { slack: "star", gchat: "⭐", web: "⭐", unicode: "⭐" },
  check: { slack: "white_check_mark", gchat: "✅", web: "✅", unicode: "✅" },
  cross: { slack: "x", gchat: "❌", web: "❌", unicode: "❌" },
  eyes: { slack: "eyes", gchat: "👀", web: "👀", unicode: "👀" },
  thinking_face: { slack: "thinking_face", gchat: "🤔", web: "🤔", unicode: "🤔" },
  nerd: { slack: "nerd_face", gchat: "🤓", web: "🤓", unicode: "🤓" },
  sweat: { slack: "sweat", gchat: "😓", web: "😓", unicode: "😓" },
  joy: { slack: "joy", gchat: "😂", web: "😂", unicode: "😂" },
  sob: { slack: "sob", gchat: "😭", web: "😭", unicode: "😭" },
  skull: { slack: "skull", gchat: "💀", web: "💀", unicode: "💀" },
  ghost: { slack: "ghost", gchat: "👻", web: "👻", unicode: "👻" },
  alien: { slack: "alien", gchat: "👽", web: "👽", unicode: "👽" },
  robot: { slack: "robot", gchat: "🤖", web: "🤖", unicode: "🤖" },
  sparkles: { slack: "sparkles", gchat: "✨", web: "✨", unicode: "✨" },
  lightning: { slack: "zap", gchat: "⚡", web: "⚡", unicode: "⚡" },
  sun: { slack: "sunny", gchat: "☀️", web: "☀️", unicode: "☀️" },
  moon: { slack: "moon", gchat: "🌙", web: "🌙", unicode: "🌙" },
  umbrella: { slack: "umbrella", gchat: "☂️", web: "☂️", unicode: "☂️" },
  coffee: { slack: "coffee", gchat: "☕", web: "☕", unicode: "☕" },
  beer: { slack: "beer", gchat: "🍺", web: "🍺", unicode: "🍺" },
  wine: { slack: "wine_glass", gchat: "🍷", web: "🍷", unicode: "🍷" },
  pizza: { slack: "pizza", gchat: "🍕", web: "🍕", unicode: "🍕" },
  taco: { slack: "taco", gchat: "🌮", web: "🌮", unicode: "🌮" },
  cookie: { slack: "cookie", gchat: "🍪", web: "🍪", unicode: "🍪" },
  cake: { slack: "cake", gchat: "🎂", web: "🎂", unicode: "🎂" },
  gift: { slack: "gift", gchat: "🎁", web: "🎁", unicode: "🎁" },
  balloon: { slack: "balloon", gchat: "🎈", web: "🎈", unicode: "🎈" },
  trophy: { slack: "trophy", gchat: "🏆", web: "🏆", unicode: "🏆" },
  medal: { slack: "medal", gchat: "🏅", web: "🏅", unicode: "🏅" },
  gem: { slack: "gem", gchat: "💎", web: "💎", unicode: "💎" },
  key: { slack: "key", gchat: "🔑", web: "🔑", unicode: "🔑" },
  lock: { slack: "lock", gchat: "🔒", web: "🔒", unicode: "🔒" },
  unlock: { slack: "unlock", gchat: "🔓", web: "🔓", unicode: "🔓" },
  link: { slack: "link", gchat: "🔗", web: "🔗", unicode: "🔗" },
  pin: { slack: "pushpin", gchat: "📌", web: "📌", unicode: "📌" },
  paperclip: { slack: "paperclip", gchat: "📎", web: "📎", unicode: "📎" },
  memo: { slack: "memo", gchat: "📝", web: "📝", unicode: "📝" },
  pencil: { slack: "pencil2", gchat: "✏️", web: "✏️", unicode: "✏️" },
  book: { slack: "book", gchat: "📖", web: "📖", unicode: "📖" },
  bulb: { slack: "bulb", gchat: "💡", web: "💡", unicode: "💡" },
  megaphone: { slack: "mega", gchat: "📢", web: "📢", unicode: "📢" },
  chart: { slack: "chart_with_upwards_trend", gchat: "📈", web: "📈", unicode: "📈" },
  gear: { slack: "gear", gchat: "⚙️", web: "⚙️", unicode: "⚙️" },
  wrench: { slack: "wrench", gchat: "🔧", web: "🔧", unicode: "🔧" },
  hammer: { slack: "hammer", gchat: "🔨", web: "🔨", unicode: "🔨" },
  nut_and_bolt: { slack: "nut_and_bolt", gchat: "🔩", web: "🔩", unicode: "🔩" },
  screwdriver: { slack: "screwdriver", gchat: "🪛", web: "🪛", unicode: "🪛" },
  magnifying_glass: { slack: "mag", gchat: "🔍", web: "🔍", unicode: "🔍" },
  shield: { slack: "shield", gchat: "🛡️", web: "🛡️", unicode: "🛡️" },
  bug: { slack: "bug", gchat: "🐛", web: "🐛", unicode: "🐛" },
  construction: { slack: "construction", gchat: "🚧", web: "🚧", unicode: "🚧" },
  warning: { slack: "warning", gchat: "⚠️", web: "⚠️", unicode: "⚠️" },
  no_entry: { slack: "no_entry", gchat: "⛔", web: "⛔", unicode: "⛔" },
  question: { slack: "question", gchat: "❓", web: "❓", unicode: "❓" },
  exclamation: { slack: "exclamation", gchat: "❗", web: "❗", unicode: "❗" },
  information: { slack: "information_source", gchat: "ℹ️", web: "ℹ️", unicode: "ℹ️" },
  white_check_mark: { slack: "white_check_mark", gchat: "✅", web: "✅", unicode: "✅" },
  ballot_box_with_check: { slack: "ballot_box_with_check", gchat: "☑️", web: "☑️", unicode: "☑️" },
  x: { slack: "x", gchat: "❌", web: "❌", unicode: "❌" },
  negative_squared_cross_mark: { slack: "negative_squared_cross_mark", gchat: "❎", web: "❎", unicode: "❎" },
  arrow_right: { slack: "arrow_right", gchat: "➡️", web: "➡️", unicode: "➡️" },
  arrow_left: { slack: "arrow_left", gchat: "⬅️", web: "⬅️", unicode: "⬅️" },
  arrow_up: { slack: "arrow_up", gchat: "⬆️", web: "⬆️", unicode: "⬆️" },
  arrow_down: { slack: "arrow_down", gchat: "⬇️", web: "⬇️", unicode: "⬇️" },
  arrow_up_right: { slack: "arrow_upper_right", gchat: "↗️", web: "↗️", unicode: "↗️" },
  arrow_down_left: { slack: "arrow_lower_left", gchat: "↙️", web: "↙️", unicode: "↙️" },
  recycle: { slack: "recycle", gchat: "♻️", web: "♻️", unicode: "♻️" },
  sparkles_2: { slack: "sparkles", gchat: "✨", web: "✨", unicode: "✨" },
  package: { slack: "package", gchat: "📦", web: "📦", unicode: "📦" },
  truck: { slack: "truck", gchat: "🚚", web: "🚚", unicode: "🚚" },
  envelope: { slack: "envelope", gchat: "✉️", web: "✉️", unicode: "✉️" },
  telephone: { slack: "telephone_receiver", gchat: "📞", web: "📞", unicode: "📞" },
  calendar: { slack: "calendar", gchat: "📅", web: "📅", unicode: "📅" },
  clock: { slack: "clock", gchat: "🕐", web: "🕐", unicode: "🕐" },
  hourglass: { slack: "hourglass", gchat: "⏳", web: "⏳", unicode: "⏳" },
  stopwatch: { slack: "stopwatch", gchat: "⏱️", web: "⏱️", unicode: "⏱️" },
  timer: { slack: "timer", gchat: "⏲️", web: "⏲️", unicode: "⏲️" },
  bell: { slack: "bell", gchat: "🔔", web: "🔔", unicode: "🔔" },
  mute: { slack: "mute", gchat: "🔇", web: "🔇", unicode: "🔇" },
  speaker: { slack: "speaker", gchat: "🔊", web: "🔊", unicode: "🔊" },
  music: { slack: "musical_note", gchat: "🎵", web: "🎵", unicode: "🎵" },
  microphone: { slack: "microphone", gchat: "🎤", web: "🎤", unicode: "🎤" },
  headphone: { slack: "headphones", gchat: "🎧", web: "🎧", unicode: "🎧" },
  camera: { slack: "camera", gchat: "📷", web: "📷", unicode: "📷" },
  film: { slack: "film_frames", gchat: "🎞️", web: "🎞️", unicode: "🎞️" },
  tv: { slack: "tv", gchat: "📺", web: "📺", unicode: "📺" },
  computer: { slack: "computer", gchat: "💻", web: "💻", unicode: "💻" },
  smartphone: { slack: "iphone", gchat: "📱", web: "📱", unicode: "📱" },
  globe: { slack: "earth_americas", gchat: "🌎", web: "🌎", unicode: "🌎" },
  map: { slack: "map", gchat: "🗺️", web: "🗺️", unicode: "🗺️" },
  compass: { slack: "compass", gchat: "🧭", web: "🧭", unicode: "🧭" },
  mountain: { slack: "mountain", gchat: "⛰️", web: "⛰️", unicode: "⛰️" },
  beach: { slack: "beach", gchat: "🏖️", web: "🏖️", unicode: "🏖️" },
  camping: { slack: "camping", gchat: "🏕️", web: "🏕️", unicode: "🏕️" },
  tree: { slack: "evergreen_tree", gchat: "🌲", web: "🌲", unicode: "🌲" },
  flower: { slack: "flower", gchat: "🌸", web: "🌸", unicode: "🌸" },
  leaf: { slack: "leaves", gchat: "🍃", web: "🍃", unicode: "🍃" },
  seedling: { slack: "seedling", gchat: "🌱", web: "🌱", unicode: "🌱" },
  dog: { slack: "dog", gchat: "🐕", web: "🐕", unicode: "🐕" },
  cat: { slack: "cat", gchat: "🐈", web: "🐈", unicode: "🐈" },
  bird: { slack: "bird", gchat: "🐦", web: "🐦", unicode: "🐦" },
  fish: { slack: "fish", gchat: "🐟", web: "🐟", unicode: "🐟" },
  butterfly: { slack: "butterfly", gchat: "🦋", web: "🦋", unicode: "🦋" },
  bee: { slack: "bee", gchat: "🐝", web: "🐝", unicode: "🐝" },
  ladybug: { slack: "lady_beetle", gchat: "🐞", web: "🐞", unicode: "🐞" },
  snail: { slack: "snail", gchat: "🐌", web: "🐌", unicode: "🐌" },
  turtle: { slack: "turtle", gchat: "🐢", web: "🐢", unicode: "🐢" },
  snake: { slack: "snake", gchat: "🐍", web: "🐍", unicode: "🐍" },
  rabbit: { slack: "rabbit", gchat: "🐇", web: "🐇", unicode: "🐇" },
  bear: { slack: "bear", gchat: "🐻", web: "🐻", unicode: "🐻" },
  panda: { slack: "panda_face", gchat: "🐼", web: "🐼", unicode: "🐼" },
  koala: { slack: "koala", gchat: "🐨", web: "🐨", unicode: "🐨" },
  tiger: { slack: "tiger", gchat: "🐅", web: "🐅", unicode: "🐅" },
  lion: { slack: "lion", gchat: "🦁", web: "🦁", unicode: "🦁" },
  cow: { slack: "cow", gchat: "🐄", web: "🐄", unicode: "🐄" },
  pig: { slack: "pig", gchat: "🐖", web: "🐖", unicode: "🐖" },
  frog: { slack: "frog", gchat: "🐸", web: "🐸", unicode: "🐸" },
  monkey: { slack: "monkey", gchat: "🐒", web: "🐒", unicode: "🐒" },
  chicken: { slack: "chicken", gchat: "🐔", web: "🐔", unicode: "🐔" },
  penguin: { slack: "penguin", gchat: "🐧", web: "🐧", unicode: "🐧" },
  whale: { slack: "whale", gchat: "🐋", web: "🐋", unicode: "🐋" },
  dolphin: { slack: "dolphin", gchat: "🐬", web: "🐬", unicode: "🐬" },
  shark: { slack: "shark", gchat: "🦈", web: "🦈", unicode: "🦈" },
  octopus: { slack: "octopus", gchat: "🐙", web: "🐙", unicode: "🐙" },
  crab: { slack: "crab", gchat: "🦀", web: "🦀", unicode: "🦀" },
  shrimp: { slack: "shrimp", gchat: "🦐", web: "🦐", unicode: "🦐" },
  squid: { slack: "squid", gchat: "🦑", web: "🦑", unicode: "🦑" },
};

// =============================================================================
// Emoji Resolution
// =============================================================================

/**
 * Resolve an emoji name to platform-specific format.
 *
 * @param name - Normalized emoji name (e.g., "thumbs_up")
 * @param platform - Target platform ("slack" | "gchat" | "web")
 * @returns Platform-specific emoji string, or the name itself if not found
 *
 * @example
 * ```typescript
 * resolveEmoji("thumbs_up", "slack"); // "+1" or "thumbsup"
 * resolveEmoji("thumbs_up", "gchat"); // "👍"
 * resolveEmoji("thumbs_up", "web"); // "👍"
 * ```
 */
export function resolveEmoji(name: string, platform: "slack" | "gchat" | "web" = "web"): string {
  const formats = DEFAULT_EMOJI_MAP[name];
  if (!formats) return name;

  const platformFormats = formats[platform];
  if (!platformFormats) {
    // Fallback to web, then unicode
    return formats.web || formats.unicode || name;
  }

  if (Array.isArray(platformFormats)) {
    return platformFormats[0]; // Return first format
  }

  return platformFormats;
}

/**
 * Get all emoji names in a category.
 *
 * @param category - Category name ("reactions" | "status" | "actions" | "all")
 * @returns Array of emoji names
 */
export function getEmojiNames(category: "reactions" | "status" | "actions" | "all" = "all"): string[] {
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
    .filter(Boolean) as string[];
}

// =============================================================================
// Emoji Categories (backward compatible)
// =============================================================================

export const EMOJI_CATEGORIES: Record<string, string[]> = {
  reactions: ["👍", "👎", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🤔", "👀"],
  status: ["✅", "❌", "⏳", "🔄", "🚀", "💡", "⭐", "🔗", "📎", "📌"],
  actions: ["👋", "🙏", "💪", "🤝", "👏", "🎯", "📊", "📈", "🔧", "⚙️"],
};

const EMOJI_PATTERN = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

export function normalizeEmoji(emoji: string): string {
  return emoji.trim();
}

export function isValidEmoji(emoji: string): boolean {
  const normalized = normalizeEmoji(emoji);
  if (!normalized) return false;
  return EMOJI_PATTERN.test(normalized);
}

export function getEmojiCategory(emoji: string): string | null {
  for (const [category, emojis] of Object.entries(EMOJI_CATEGORIES)) {
    if (emojis.includes(emoji)) return category;
  }
  return null;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Immutable emoji value with object identity.
 */
export interface EmojiValue {
  readonly name: string;
  toString(): string;
  toJSON(): string;
}
