import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        conduit: {
          bg:      "var(--bg)",
          surface: "var(--panel)",
          border:  "var(--line)",
          muted:   "var(--fg-mute)",
          text:    "var(--fg)",
          accent:  "var(--accent)",
          dim:     "var(--accent-soft)",
          prompt:  "var(--prompt)",
          user:    "var(--user-msg)",
          ai:      "var(--ai-msg)",
        },
      },
      fontFamily: {
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      keyframes: {
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
      },
      animation: {
        blink: "blink 1.1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
