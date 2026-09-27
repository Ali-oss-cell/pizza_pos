import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "var(--color-accent, #f43f5e)",
        "accent-dim": "var(--color-accent-dim, #e11d48)",
        surface: "#09090b",
        "on-surface": "#f4f4f5",
        "surface-container": "#18181b",
        "surface-container-high": "#27272a",
        outline: "#a1a1aa",
      },
      fontFamily: {
        sans: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.45)",
        "pay-glow": "0 0 24px color-mix(in srgb, var(--color-accent, #f43f5e) 45%, transparent)",
      },
      backgroundImage: {
        "pay-gradient":
          "linear-gradient(135deg, var(--color-accent, #f43f5e) 0%, #a855f7 100%)",
      },
      minHeight: {
        touch: "44px",
        "touch-lg": "48px",
        "category-tab": "44px",
        "item-card": "80px",
      },
      minWidth: {
        touch: "44px",
        "touch-lg": "48px",
      },
      fontSize: {
        "pos-item": ["0.9375rem", { lineHeight: "1.25", fontWeight: "600" }],
        "pos-price": ["0.875rem", { lineHeight: "1.25", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};

export default config;
