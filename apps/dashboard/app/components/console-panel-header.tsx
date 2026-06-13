import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConsolePanelHeaderProps {
  title: string;
  description?: string;
  onClose?: () => void;
}

export function ConsolePanelHeader({ title, description, onClose }: ConsolePanelHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {onClose ? (
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
