export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@fluxy-chat/ui/dist/**/*.{js,mjs}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        muted: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--text-muted)",
        },
        primary: {
          DEFAULT: "var(--fluxy-cta-color)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--surface-muted)",
          foreground: "var(--foreground)",
        },
        card: {
          DEFAULT: "var(--surface-card)",
          foreground: "var(--foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "#ffffff",
        },
        ring: "var(--ring)",
      },
      borderRadius: {
        lg: "var(--radius)",
      },
    },
  },
  plugins: [],
};
