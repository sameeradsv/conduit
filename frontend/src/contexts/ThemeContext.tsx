"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "phosphor" | "terminal";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "phosphor", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("phosphor");

  useEffect(() => {
    const saved = (localStorage.getItem("conduit-theme") as Theme) || "phosphor";
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("conduit-theme", t);
    document.documentElement.setAttribute("data-theme", t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "phosphor" ? "#0b110b" : "#f4f9f4");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
