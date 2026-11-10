import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

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
          DEFAULT: "rgb(var(--brand-accent) / <alpha-value>)",
          light: "rgb(var(--brand-accent) / <alpha-value>)",
          dark: "rgb(var(--brand-accent-dark) / <alpha-value>)",
        },
        hadar: {
          orange: "rgb(var(--brand-accent) / <alpha-value>)",
          dark: "#111111",
          white: "#FFFFFF",
        },
        sidebar: {
          DEFAULT: "#ffffff",
          hover: "#f5f5f4",
          active: "var(--brand-active)",
        },
      },
    },
  },
  plugins: [animate],
};
export default config;
