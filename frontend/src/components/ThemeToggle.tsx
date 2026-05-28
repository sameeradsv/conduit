"use client";

import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "phosphor" ? "ghost" : "phosphor";
  return (
    <button
      className="pill-btn"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} theme`}
    >
      {theme === "phosphor" ? "◑ green" : "◑ ghost"}
    </button>
  );
}
