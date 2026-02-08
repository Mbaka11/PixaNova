import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A1122",
        slate: "#18243D",
        accent: "#00C2A8",
        gold: "#F4B942"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"]
      },
      boxShadow: {
        panel: "0 18px 36px rgba(5, 10, 20, 0.3)"
      }
    }
  },
  plugins: []
};

export default config;
