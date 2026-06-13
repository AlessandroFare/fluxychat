"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LlmProviderRegistryOverview } from "@/app/components/llm-provider-registry-overview";
import { LlmProviderCredentials } from "@/app/components/llm-provider-credentials";
import { Button } from "@/app/components/ui";
import { useAgentsConsole } from "../agents-console-context";

export default function AgentsLlmKeysPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return")?.trim() || "/agents";
  const focusProvider = searchParams.get("provider")?.trim() || null;
  const { adminJwt, llmCatalog, loadLiveModels, setLoadLiveModels, reloadLlmCatalog } =
    useAgentsConsole();

  if (!adminJwt.trim()) {
    return (
      <p className="text-sm text-muted-foreground">
        Admin JWT required to configure LLM keys.{" "}
        <Link href="/onboarding" className="font-medium underline">
          Complete quickstart
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
        <span className="text-foreground">Return to your previous page after saving keys.</span>
        <Button variant="neutral" size="sm" onClick={() => router.push(returnTo)}>
          Back
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={loadLiveModels}
            onChange={(e) => setLoadLiveModels(e.target.checked)}
          />
          Load live OpenRouter models in catalog
        </label>
        <Button variant="ghost" size="sm" onClick={() => router.push(returnTo)}>
          Close
        </Button>
      </div>
      <LlmProviderRegistryOverview catalog={llmCatalog} />
      <LlmProviderCredentials
        adminJwt={adminJwt}
        focusProviderId={focusProvider}
        onSaved={() => void reloadLlmCatalog()}
      />
    </div>
  );
}
