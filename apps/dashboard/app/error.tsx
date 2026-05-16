"use client";

import { useEffect } from "react";
import { messageFromUnknown } from "@/lib/error-message";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(messageFromUnknown(error, "Route error"));
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-16">
      <h2 className="text-lg font-semibold text-neutral-900">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-neutral-600">
        Something broke in the dashboard. Try again, or reload the page.
      </p>
      <button
        type="button"
        className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
