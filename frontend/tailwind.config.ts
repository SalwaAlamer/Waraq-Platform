import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0a0a",
        card: "#111111",
        primary: "#3b82f6",
        success: "#22c55e",
        error: "#ef4444",
        warning: "#f59e0b"
      },
      fontFamily: {
        sans: ["Inter", "Cairo", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
