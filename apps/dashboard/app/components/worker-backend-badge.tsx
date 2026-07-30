"use client";

import { Cloud, CloudOff } from "lucide-react";
import { Badge } from "~/components/ui/badge";

export function WorkerBackendBadge({ connected, label = "Worker" }: { connected: boolean; label?: string }) {
  return (
    <Badge variant="outline" className="gap-1">
      {connected ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
      {connected ? `${label} synced` : `${label} demo (local)`}
    </Badge>
  );
}
