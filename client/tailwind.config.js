/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Dark mode follows the data-theme attribute on <html> (see src/lib/theme.ts).
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      // Research-canvas design tokens (see src/index.css :root for the source
      // values — Tailwind reads the CSS variables so there is one definition).
      colors: {
        canvas: "var(--canvas-bg)",
        surface: {
          DEFAULT: "var(--surface)",
          sunken: "var(--surface-sunken)",
          muted: "var(--surface-muted)",
          hover: "var(--surface-hover)",
          row: "var(--surface-row)",
        },
        "on-ink": "var(--on-ink)",
        line: {
          DEFAULT: "var(--border)",
          control: "var(--border-control)",
          divider: "var(--divider)",
          soft: "var(--divider-soft)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          hover: "var(--ink-hover)",
          2: "var(--text-2)",
          3: "var(--text-3)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
          icon: "var(--icon-muted)",
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
