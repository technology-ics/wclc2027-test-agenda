import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        iaslc: "#203D7C",
        azul: "#16A1DC",
        accent: "#EA8723",
        ink: "#1a2332",
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "Arial", "Helvetica", "sans-serif"],
        display: ["var(--font-condensed)", "Arial Narrow", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
