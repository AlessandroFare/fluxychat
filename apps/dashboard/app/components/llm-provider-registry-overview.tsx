"use client";

import { useMemo } from "react";
import { Wrench, Zap } from "lucide-react";
import type { LlmCatalogResponse } from "@/lib/llm-catalog-client";
import { listProviderOptions } from "@/lib/llm-registry-ui";
import { LlmCredentialStatus } from "./llm-credential-status";
import { cn } from "@/lib/utils";

interface LlmProviderRegistryOverviewProps {
  catalog: LlmCatalogResponse | null;
  className?: string;
}

export function LlmProviderRegistryOverview({
  catalog,
  className,
}: LlmProviderRegistryOverviewProps) {
  const providers = useMemo(() => listProviderOptions(catalog), [catalog]);

  if (!catalog) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Load the LLM catalog (admin JWT) to see provider capabilities and key status.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm text-muted-foreground">
        Registry from your Worker — same providers as{" "}
        <code className="text-xs">GET /llm/providers</code>. Project keys override Worker env.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => {
          const full = catalog.providers.find((x) => x.id === p.id);
          return (
            <div
              key={p.id}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
            >
              <div className="font-medium text-foreground">{p.label}</div>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.id}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <LlmCredentialStatus status={full?.credentialStatus} />
                {full?.supportsStreaming ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    stream
                  </span>
                ) : null}
                {full?.supportsTools ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    tools
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {full?.models.length ?? 0} preset models · {full?.apiStyle ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
      {catalog.shortcuts.length ? (
        <p className="text-xs text-muted-foreground">
          Shortcuts:{" "}
          {catalog.shortcuts
            .slice(0, 6)
            .map((s) => (
              <code key={s.alias} className="mr-2">
                {s.alias}
              </code>
            ))}
          …
        </p>
      ) : null}
    </div>
  );
}
