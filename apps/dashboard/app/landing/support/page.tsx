import { VerticalUseCasePage, verticalPageMetadata } from "../vertical-use-case";
import { verticalLandingBySlug } from "@/lib/vertical-landing";

const page = verticalLandingBySlug("support")!;

export const metadata = verticalPageMetadata(page);

export default function SupportLandingPage() {
  return <VerticalUseCasePage page={page} />;
}
