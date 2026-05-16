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
          DEFAULT: "#ff725e",
          dark: "#F28069",
          muted: "rgba(255, 114, 94, 0.1)",
          light: "rgba(255, 114, 94, 0.05)",
          hover: "#e8614d",
        },
        text: {
          DEFAULT: "#0E1316",
          muted: "#745050",
          secondary: "#979797",
          light: "#c9c9cf",
        },
        // shadcn semantic tokens
        primary: "#ff725e",
        destructive: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#F3F0EC",
          foreground: "#6b7280",
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
