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
        accent: "#FF2B79",
        "accent-dim": "#cc2261",
        surface: "#131315",
        "on-surface": "#e5e1e4",
        "surface-container": "#201f21",
        "surface-container-high": "#2a2a2c",
        outline: "#ab888e",
      },
      fontFamily: {
        sans: [
          "var(--font-pos)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      minHeight: {
        touch: "48px",
        "touch-lg": "56px",
        "category-tab": "56px",
        "item-card": "120px",
      },
      minWidth: {
        touch: "48px",
        "touch-lg": "56px",
      },
      fontSize: {
        "pos-item": ["1.0625rem", { lineHeight: "1.25", fontWeight: "700" }],
        "pos-price": ["1rem", { lineHeight: "1.25", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};

export default config;
