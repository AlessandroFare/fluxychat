import type { ReactNode } from "react";

const methodColors: Record<string, string> = {
  GET: "text-blue-600 dark:text-blue-400",
  POST: "text-green-600 dark:text-green-400",
  PUT: "text-amber-600 dark:text-amber-400",
  PATCH: "text-yellow-600 dark:text-yellow-400",
  DELETE: "text-red-600 dark:text-red-400",
};

export function renderMethodBadge(method: string): ReactNode {
  const color = methodColors[method.toUpperCase()] ?? "text-fd-muted-foreground";
  return (
    <span className={`font-mono font-medium ${color} ms-auto text-xs text-nowrap`}>
      {method.toUpperCase()}
    </span>
  );
}
