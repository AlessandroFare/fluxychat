import { PLATFORM_READINESS, type PlatformReadinessLabel } from "@fluxy-chat/sdk";

export interface ReadinessDisplayEntry {
  id: string;
  label: string;
  href: string;
  description: string;
  readiness: PlatformReadinessLabel;
  readinessLabel: string;
}

const READINESS_LABEL: Record<PlatformReadinessLabel, string> = {
  production: "Production",
  beta: "Beta",
  preview: "Preview",
  prototype: "Prototype",
  labs: "Labs",
};

export function formatReadinessLabel(readiness: PlatformReadinessLabel): string {
  return READINESS_LABEL[readiness];
}

export function readinessBadgeClass(readiness: PlatformReadinessLabel | string): string {
  const normalized = typeof readiness === "string" ? readiness.toLowerCase() : readiness;
  if (normalized === "production") return "bg-emerald-500/15 text-emerald-700";
  if (normalized === "beta") return "bg-sky-500/15 text-sky-700";
  if (normalized === "preview") return "bg-amber-500/15 text-amber-800";
  if (normalized === "labs") return "bg-violet-500/15 text-violet-700";
  return "bg-slate-500/15 text-slate-700";
}

export function listProductReadiness(): ReadinessDisplayEntry[] {
  return (["chat", "collab", "stream", "voice", "game", "iot", "fleet", "spatial"] as const).map((id) => {
    const entry = PLATFORM_READINESS[id];
    return {
      id,
      label: entry.label,
      href: entry.href,
      description: entry.description,
      readiness: entry.readiness,
      readinessLabel: formatReadinessLabel(entry.readiness),
    };
  });
}

export function listIndustryReadiness(): ReadinessDisplayEntry[] {
  return (["edu", "health", "event", "finance", "continuity"] as const).map((id) => {
    const entry = PLATFORM_READINESS[id];
    return {
      id,
      label: entry.label,
      href: entry.href,
      description: entry.description,
      readiness: entry.readiness,
      readinessLabel: formatReadinessLabel(entry.readiness),
    };
  });
}
