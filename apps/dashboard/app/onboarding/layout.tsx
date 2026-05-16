import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";

export const metadata: Metadata = PAGE_METADATA.onboarding;

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
