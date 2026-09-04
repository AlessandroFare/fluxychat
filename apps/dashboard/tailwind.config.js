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
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--fluxy-cta-rgb) / <alpha-value>)",
          dark: "#ff8a47",
          muted: "rgba(194, 65, 12, 0.1)",
          light: "rgba(194, 65, 12, 0.05)",
          hover: "#9a3412",
        },
        text: {
          DEFAULT: "var(--text-primary)",
          muted: "var(--text-muted)",
          secondary: "var(--text-muted)",
          light: "#c9c9cf",
        },
        primary: {
          DEFAULT: "rgb(var(--fluxy-cta-rgb) / <alpha-value>)",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "rgb(var(--surface-muted-rgb) / <alpha-value>)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "rgb(var(--surface-muted-rgb) / <alpha-value>)",
          foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--surface-card-rgb) / <alpha-value>)",
          foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        },
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--background-rgb) / <alpha-value>)",
          muted: "rgb(var(--surface-muted-rgb) / <alpha-value>)",
          card: "rgb(var(--surface-card-rgb) / <alpha-value>)",
        },
        "dark-mode": {
          DEFAULT: "#1e1e1e",
          muted: "#252525",
          card: "#2a2a2a",
        },
        "dark-text": {
          primary: "#f9fafb",
          muted: "#9ca3af",
        },
        "dark-border": "#1f2937",
        "dark-destructive": "#ef4444",
        "dark-success": "#22c55e",
        "light-success": "#16a34a",
      },
      borderRadius: {
        none: "0px",
        sm: "8px",
        DEFAULT: "8px",
        md: "8px",
        lg: "8px",
        xl: "8px",
        "2xl": "16px",
        "3xl": "16px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 3px hsla(0, 0%, 0%, 0.2)",
        DEFAULT: "0 4px 6px hsla(0, 0%, 0%, 0.2)",
        md: "0 5px 15px hsla(0, 0%, 0%, 0.2)",
        lg: "0 10px 24px hsla(0, 0%, 0%, 0.2)",
        xl: "0 15px 35px hsla(0, 0%, 0%, 0.2)",
        "2xl": "0 15px 35px hsla(0, 0%, 0%, 0.2)",
        card: "var(--shadow-1)",
        modal: "var(--shadow-5)",
        dropdown: "var(--shadow-2)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        heading: [
          "var(--font-sans)",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
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
