/** @type {import('tailwindcss').Config} */
export default {
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
        canvas: "#F5F5F7",
        ink: {
          DEFAULT: "#1D1D1F",
          soft: "#6E6E73",
          faint: "#AEAEB2",
        },
        line: "#E5E5EA",
        accent: {
          DEFAULT: "#0071E3",
          hover: "#0077ED",
          soft: "#E8F1FC",
        },
        status: {
          idle: "#8E8E93",
          low: "#5AC8FA",
          normal: "#34C759",
          padat: "#FF9F0A",
          overload: "#FF3B30",
        },
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
