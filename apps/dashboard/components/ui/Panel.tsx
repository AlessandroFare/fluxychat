import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends ComponentPropsWithoutRef<"div"> {
  title?: string;
}

export function Panel({ children, title, className, ...rest }: PanelProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-sm border border-border bg-card p-4",
        className,
      )}
    >
      {title ? <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2> : null}
      {children}
    </div>
  );
}
