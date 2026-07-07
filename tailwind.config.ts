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
        sans: ["var(--font-body)", "Montserrat", "system-ui", "sans-serif"],
        display: ["TG Praktikal", "system-ui", "sans-serif"],
      },
      minHeight: {
        touch: "40px",
        "touch-lg": "44px",
        "category-tab": "40px",
        "item-card": "80px",
      },
      minWidth: {
        touch: "40px",
        "touch-lg": "44px",
      },
      fontSize: {
        "pos-item": ["0.9375rem", { lineHeight: "1.25", fontWeight: "700" }],
        "pos-price": ["0.875rem", { lineHeight: "1.25", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};

export default config;
