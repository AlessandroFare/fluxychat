"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, FC, ReactNode } from "react";

type NextThemesProviderProps = ComponentProps<typeof NextThemesProvider>;

export type AppThemeProviderProps = {
  children: ReactNode;
} & Omit<NextThemesProviderProps, "children">;

/** Wraps next-themes; explicit `children` for React 19 (@types/react dropped PropsWithChildren). */
export function ThemeProvider({ children, ...props }: AppThemeProviderProps) {
  const Provider = NextThemesProvider as FC<
    NextThemesProviderProps & { children?: ReactNode }
  >;
  return <Provider {...props}>{children}</Provider>;
}
