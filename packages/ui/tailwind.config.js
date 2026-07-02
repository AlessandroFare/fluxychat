/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
  // Presets are intentionally empty — the consuming app (dashboard) supplies
  // the full theme tokens. This config exists so `tailwindcss` can find the
  // content files when `packages/ui` is developed or published standalone.
  presets: [],
};
