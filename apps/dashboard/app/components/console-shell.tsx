import { cn } from "@/lib/utils";

/**
 * Shared page chrome for console / operator routes (matches landing warm light surfaces).
 */
export function ConsoleShell({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1200px] px-4 py-6 pb-14 sm:px-6 sm:py-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
