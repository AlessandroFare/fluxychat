"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Textarea } from "./ui";

export interface ManualJwtFieldsProps {
  adminJwt: string;
  onAdminJwtChange: (value: string) => void;
  onContinue: () => void;
  className?: string;
}

export function ManualJwtFields({
  adminJwt,
  onAdminJwtChange,
  onContinue,
  className,
}: ManualJwtFieldsProps) {
  return (
    <div className={className}>
      <p className="mb-3 text-sm text-muted-foreground">
        Mint with{" "}
        <code className="rounded bg-muted px-1 font-mono text-xs">POST /auth/token</code> and your project API key, or
        paste a bootstrap token from ops. See{" "}
        <Link href="/get-started" className="font-medium text-primary underline-offset-2 hover:underline">
          get started
        </Link>
        .
      </p>
      <Textarea
        data-testid="admin-jwt-input"
        value={adminJwt}
        onChange={(e) => onAdminJwtChange(e.target.value)}
        rows={4}
        placeholder="Paste admin or owner JWT"
        className="font-mono text-xs"
      />
      <div className="mt-4">
        <Button
          type="button"
          variant="default"
          data-testid="connect-continue"
          disabled={adminJwt.trim().length < 12}
          onClick={onContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
