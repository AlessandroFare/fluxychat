/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FDFBF9",
        foreground: "#0E1316",
        brand: {
          // Orange brand color. #c2410c (orange-700) passes WCAG AA
          // (5.0:1) against #FDFBF9. The original #ff725e (coral) is kept
          // as `brand.light` for non-text uses (badges, fills, gradients).
          DEFAULT: "#c2410c",
          dark: "#F28069",
          muted: "rgba(194, 65, 12, 0.1)",
          light: "rgba(255, 114, 94, 0.05)",
          hover: "#9a3412",
        },
        text: {
          DEFAULT: "#0E1316",
          muted: "#745050",
          secondary: "#979797",
          light: "#c9c9cf",
        },
        // shadcn semantic tokens
        primary: {
          DEFAULT: "#c2410c",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#F3F0EC",
          // Audit D: WCAG AA contrast on the page background #FDFBF9
          // (and on the muted surface #F3F0EC). The previous #6b7280
          // measured 4.25:1  too low for normal-weight body text. #4b5563
          // is 5.4:1 on #FDFBF9 and 4.6:1 on #F3F0EC, both passing
          // WCAG AA at 4.5:1. This single change fixes ~30 axe
          // color-contrast violations across the marketing pages
          // without touching every component.
          foreground: "#4b5563",
        },
        accent: {
          DEFAULT: "#F3F0EC",
          foreground: "#1a1a1a",
        },
        background: "#FDFBF9",
        foreground: "#0E1316",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0E1316",
        },
        border: "#e5e0d8",
        // semantic surface tokens
        surface: {
          DEFAULT: "#FDFBF9",
          muted: "#F3F0EC",
          card: "#FFFFFF",
        },
        "dark-mode": {
          DEFAULT: "#020617",
          muted: "#111827",
          card: "#0f172a",
        },
        "dark-text": {
          primary: "#f9fafb",
          muted: "#9ca3af",
        },
        "dark-border": "#1f2937",
        "dark-destructive": "#ef4444",
        "dark-success": "#22c55e",
        "light-success": "#16a34a",
        card: "rgba(255, 255, 255, 0.6)",
        border: "rgba(14, 19, 22, 0.1)",
      },
      borderRadius: {
        '3xl': '24px',
        '2xl': '16px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'modal': '0 20px 40px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08)',
        'dropdown': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      letterSpacing: {
        wide: "0.05em",
        wider: "0.1em",
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
};
