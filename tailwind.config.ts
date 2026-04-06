import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          DEFAULT: "#F85021",
          light: "#F85021",
          dark: "#d4411a",
        },
        hadar: {
          orange: "#F85021",
          dark: "#111111",
          white: "#FFFFFF",
        },
        sidebar: {
          DEFAULT: "#0f0f0f",
          hover: "#1a1a1a",
          active: "#252525",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
