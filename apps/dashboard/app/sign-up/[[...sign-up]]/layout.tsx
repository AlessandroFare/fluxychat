import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";

export const metadata: Metadata = PAGE_METADATA.signUp;

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
