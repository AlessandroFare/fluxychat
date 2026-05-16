import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { LandingView } from "./landing-view";

export const metadata: Metadata = PAGE_METADATA.landing;

export default function LandingPage() {
  return <LandingView />;
}
