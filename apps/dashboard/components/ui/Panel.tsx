import { cn } from "@/lib/utils";

interface PanelProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Panel({ children, title, className }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-[var(--shadow-subtle-2)] backdrop-blur-sm",
        className,
      )}
    >
      {title ? <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2> : null}
      {children}
    </div>
  );
}
