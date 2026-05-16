import { cn } from "@/lib/utils";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-[var(--shadow-subtle-2)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
