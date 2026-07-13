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
        // Near-black surfaces, pump.fun-GO style
        ink: {
          950: "#08090b",
          900: "#0d0e12",
          850: "#121319",
          800: "#181a21",
          700: "#232631",
          600: "#333747",
        },
        lime: {
          DEFAULT: "#b8ff2f",
          bright: "#c9ff5c",
          dim: "#8fd21f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(184,255,47,0.4), 0 0 24px -6px rgba(184,255,47,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
