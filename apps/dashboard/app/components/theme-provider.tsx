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
    const next = t === "dark" ? "dark" : "light";
    setThemeState(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore quota / private mode */
    }
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(next);
    root.style.colorScheme = next;
  }, []);

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
