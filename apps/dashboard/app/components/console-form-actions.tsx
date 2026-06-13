import { Button } from "./ui";

interface ConsoleFormActionsProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
}

export function ConsoleFormActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  cancelLabel = "Cancel",
  onCancel,
}: ConsoleFormActionsProps) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Button
        className="bg-brand text-white hover:bg-[#e8614d]"
        variant="neutral"
        onClick={onPrimary}
        disabled={primaryDisabled || primaryLoading}
      >
        {primaryLoading ? `${primaryLabel}…` : primaryLabel}
      </Button>
      {onCancel ? (
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  );
}
