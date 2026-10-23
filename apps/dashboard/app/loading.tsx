import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-[1200px] overflow-x-hidden px-4 py-6 pb-14 sm:px-6 sm:py-8"
    >
      <span className="sr-only">Loading…</span>
      <div className="mb-6 border-b border-border pb-5">
        <Skeleton aria-hidden className="mb-3 h-3 w-40" />
        <Skeleton aria-hidden className="h-7 w-56" />
        <Skeleton aria-hidden className="mt-3 h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton aria-hidden className="h-28 rounded-xl" />
        <Skeleton aria-hidden className="h-28 rounded-xl" />
        <Skeleton aria-hidden className="h-28 rounded-xl" />
      </div>
      <Skeleton aria-hidden className="mt-4 h-64 rounded-xl" />
    </div>
  );
}
