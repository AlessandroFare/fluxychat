"use client";

import { ClerkRoot } from "./clerk-root";

interface ClerkShellProps {
  publishableKey: string;
  children: React.ReactNode;
}

export function ClerkShell({ publishableKey, children }: ClerkShellProps) {
  return <ClerkRoot publishableKey={publishableKey}>{children}</ClerkRoot>;
}
