import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        palenight: {
          bg: "#292D3E",
          surface: "#444267",
          accent: "#c792ea",
          secondary: "#89ddff",
          success: "#c3e88d",
          warning: "#ffcb6b",
          error: "#ff5370",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        scan: "scan 2s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
