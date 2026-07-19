"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface ThemeContextValue {
  theme: string;
  setTheme: (t: string) => void;
  resolvedTheme: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  resolvedTheme: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "light",
}: {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  forcedTheme?: string;
}) {
  const [theme, setThemeState] = useState(defaultTheme);

  const setTheme = useCallback((t: string) => {
    setThemeState(t);
    try { localStorage.setItem("theme", t); } catch {}
    if (attribute === "class") {
      document.documentElement.className = document.documentElement.className
        .replace(/\btheme-\S+|light|dark\b/g, "")
        .trim();
      document.documentElement.classList.add(t);
    } else {
      document.documentElement.setAttribute(`data-${attribute}`, t);
    }
  }, [attribute]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial = saved || defaultTheme;
    setTheme(initial);
  }, [defaultTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: theme }}>
      {children}
    </ThemeContext.Provider>
  );
}
