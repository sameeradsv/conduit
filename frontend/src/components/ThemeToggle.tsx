"use client";

import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      className="theme-btn"
      onClick={() => setTheme(theme === "phosphor" ? "terminal" : "phosphor")}
      title={`Switch to ${theme === "phosphor" ? "terminal (light)" : "phosphor (dark)"}`}
    >
      {theme === "phosphor" ? "[light]" : "[dark]"}
    </button>
  );
}
