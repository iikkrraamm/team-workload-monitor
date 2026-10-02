/** @type {import('tailwindcss').Config} */

// Colors are CSS variables (see index.css) holding "R G B" so that opacity
// modifiers such as bg-ink/5 keep working and a theme is just a different set
// of values for the same names.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "Inter",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        canvas: v("canvas"),
        // Cards, inputs, modals, popovers: anything that sits on the canvas.
        surface: v("surface"),
        ink: {
          DEFAULT: v("ink"),
          soft: v("ink-soft"),
          faint: v("ink-faint"),
        },
        line: v("line"),
        accent: {
          // Accent as text, icon, border or tint (e.g. text-accent, bg-accent/10).
          DEFAULT: v("accent"),
          hover: v("accent-hover"),
          soft: v("accent-soft"),
          // Accent as a solid fill under white text (buttons, chat bubble,
          // logo). Kept dark enough for white text in both themes.
          solid: v("accent-solid"),
          "solid-hover": v("accent-solid-hover"),
        },
        status: {
          idle: v("status-idle"),
          low: v("status-low"),
          normal: v("status-normal"),
          padat: v("status-padat"),
          overload: v("status-overload"),
        },
        // Text colors for badges on a tinted status background.
        ok: v("ok"),
        warn: v("warn"),
        info: v("info"),
      },
      borderRadius: {
        xl2: "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.08)",
        card: "0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.04)",
        popover: "0 20px 45px -15px rgba(0,0,0,0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
