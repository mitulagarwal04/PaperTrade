import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B0D10",
        foreground: "#EDEEF0",
        surface: {
          1: "#13161C",
          2: "#1A1E27",
          3: "#232833",
        },
        primary: {
          DEFAULT: "#EDEEF0",
          foreground: "#0B0D10",
        },
        secondary: {
          DEFAULT: "#A0A5B0",
          foreground: "#0B0D10",
        },
        muted: {
          DEFAULT: "#6B7280",
          foreground: "#EDEEF0",
        },
        info: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },
        positive: {
          DEFAULT: "#22C55E",
          foreground: "#000000",
          dim: "#166534",
        },
        negative: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
          dim: "#7F1D1D",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#000000",
          dim: "#78350F",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        border: {
          DEFAULT: "#2A2F3B",
          subtle: "#1F232E",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
