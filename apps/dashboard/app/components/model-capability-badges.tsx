import type { ModelCapabilities } from "@/lib/llm-catalog-client";

interface ModelCapabilityBadgesProps {
  capabilities: ModelCapabilities;
}

export function ModelCapabilityBadges({ capabilities }: ModelCapabilityBadgesProps) {
  const items: string[] = [];
  if (capabilities.imageInput) items.push("vision");
  if (capabilities.objectGeneration) items.push("JSON");
  if (capabilities.toolUsage) items.push("tools");
  if (capabilities.toolStreaming) items.push("stream tools");
  if (!items.length) return null;

  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((tag) => (
        <span
          key={tag}
          className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
