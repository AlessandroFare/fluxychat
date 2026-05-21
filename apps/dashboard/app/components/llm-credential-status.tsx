"use client";

import { cn } from "@/lib/utils";
import { credentialStatusSummary } from "@/lib/llm-registry-ui";
import type { LlmCatalogProvider } from "@/lib/llm-catalog-client";

interface LlmCredentialStatusProps {
  status: LlmCatalogProvider["credentialStatus"] | undefined;
  className?: string;
}

export function LlmCredentialStatus({ status, className }: LlmCredentialStatusProps) {
  const { ready, label } = credentialStatusSummary(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        ready
          ? "bg-emerald-100 text-emerald-900"
          : "bg-amber-100 text-amber-950",
        className,
      )}
      title={
        status
          ? `Project: ${status.project}, Worker env: ${status.worker}`
          : undefined
      }
    >
      {label}
    </span>
  );
}
