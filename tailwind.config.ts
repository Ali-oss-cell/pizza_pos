import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#FF2B79",
        surface: "#131315",
        "on-surface": "#e5e1e4",
        "surface-container": "#201f21",
        "surface-container-high": "#2a2a2c",
        outline: "#ab888e",
      },
      minHeight: {
        touch: "48px",
      },
      minWidth: {
        touch: "48px",
      },
    },
  },
  plugins: [],
};

export default config;
