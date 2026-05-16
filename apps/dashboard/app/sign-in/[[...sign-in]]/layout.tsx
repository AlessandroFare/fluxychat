import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";

export const metadata: Metadata = PAGE_METADATA.signIn;

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
