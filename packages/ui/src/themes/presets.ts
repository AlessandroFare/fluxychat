export interface FluxyThemeTokens {
  "--fluxy-bubble-sent-bg": string;
  "--fluxy-bubble-sent-text": string;
  "--fluxy-bubble-received-bg": string;
  "--fluxy-bubble-received-border": string;
  "--fluxy-bubble-received-text": string;
  "--fluxy-mention-bg"?: string;
  "--fluxy-mention-text"?: string;
  "--fluxy-header-bg"?: string;
  "--fluxy-header-text"?: string;
  "--fluxy-header-subtext"?: string;
  "--fluxy-btn-primary-bg"?: string;
  "--fluxy-btn-primary-text"?: string;
}

export const FLUXY_THEME_IDS = ["default", "dark", "minimal", "brand"] as const;
export type FluxyThemeId = (typeof FLUXY_THEME_IDS)[number];

export const FLUXY_THEMES: Record<FluxyThemeId, FluxyThemeTokens> = {
  default: {
    "--fluxy-bubble-sent-bg": "#FF6A1A",
    "--fluxy-bubble-sent-text": "#FFFFFF",
    "--fluxy-bubble-received-bg": "#F4F4F5",
    "--fluxy-bubble-received-border": "#E4E4E7",
    "--fluxy-bubble-received-text": "#1A1A1A",
    "--fluxy-mention-bg": "rgba(255, 106, 26, 0.18)",
    "--fluxy-mention-text": "#C2410C",
    "--fluxy-header-bg": "#C2410C",
    "--fluxy-header-text": "#FFFFFF",
    "--fluxy-header-subtext": "#FFDCC8",
    "--fluxy-btn-primary-bg": "#C2410C",
    "--fluxy-btn-primary-text": "#FFFFFF",
  },
  dark: {
    "--fluxy-bubble-sent-bg": "#E85F17",
    "--fluxy-bubble-sent-text": "#FFFFFF",
    "--fluxy-bubble-received-bg": "#1F2937",
    "--fluxy-bubble-received-border": "#2B3648",
    "--fluxy-bubble-received-text": "#F3F4F6",
    "--fluxy-mention-bg": "rgba(232, 95, 23, 0.25)",
    "--fluxy-mention-text": "#FDBA74",
    "--fluxy-header-bg": "#111827",
    "--fluxy-header-text": "#F9FAFB",
    "--fluxy-header-subtext": "#D1D5DB",
    "--fluxy-btn-primary-bg": "#E85F17",
    "--fluxy-btn-primary-text": "#FFFFFF",
  },
  minimal: {
    "--fluxy-bubble-sent-bg": "#18181B",
    "--fluxy-bubble-sent-text": "#FAFAFA",
    "--fluxy-bubble-received-bg": "#FFFFFF",
    "--fluxy-bubble-received-border": "#E4E4E7",
    "--fluxy-bubble-received-text": "#27272A",
    "--fluxy-mention-bg": "rgba(24, 24, 27, 0.08)",
    "--fluxy-mention-text": "#18181B",
    "--fluxy-header-bg": "#FAFAFA",
    "--fluxy-header-text": "#18181B",
    "--fluxy-header-subtext": "#52525B",
    "--fluxy-btn-primary-bg": "#18181B",
    "--fluxy-btn-primary-text": "#FAFAFA",
  },
  brand: {
    "--fluxy-bubble-sent-bg": "#6366F1",
    "--fluxy-bubble-sent-text": "#FFFFFF",
    "--fluxy-bubble-received-bg": "#EEF2FF",
    "--fluxy-bubble-received-border": "#C7D2FE",
    "--fluxy-bubble-received-text": "#1E1B4B",
    "--fluxy-mention-bg": "rgba(99, 102, 241, 0.15)",
    "--fluxy-mention-text": "#4338CA",
    "--fluxy-header-bg": "#4338CA",
    "--fluxy-header-text": "#FFFFFF",
    "--fluxy-header-subtext": "#DDD6FE",
    "--fluxy-btn-primary-bg": "#4338CA",
    "--fluxy-btn-primary-text": "#FFFFFF",
  },
};
