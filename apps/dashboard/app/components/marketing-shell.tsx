import { cn } from "@/lib/utils";

/** Centered content width for guides, docs, get-started — no console sidebar. */
export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:max-w-4xl", className)}>
      {children}
    </div>
  );
}
