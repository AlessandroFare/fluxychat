import { cn } from "@/lib/utils";

/** Centered content width for guides, docs, why, compare — matches landing header (max-w-6xl). */
export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12", className)}>
      {children}
    </div>
  );
}

