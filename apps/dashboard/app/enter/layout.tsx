import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";

export const metadata: Metadata = PAGE_METADATA.enter;

export default function EnterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
