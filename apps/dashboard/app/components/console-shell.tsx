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
        "fc-console mx-auto w-full max-w-[1320px] overflow-x-hidden px-4 py-7 pb-16 sm:px-6 sm:py-9 lg:px-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
