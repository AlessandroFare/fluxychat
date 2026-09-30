import { VerticalUseCasePage, verticalPageMetadata } from "../vertical-use-case";
import { verticalLandingBySlug } from "@/lib/vertical-landing";

const page = verticalLandingBySlug("incident")!;

export const metadata = verticalPageMetadata(page);

export default function IncidentLandingPage() {
  return <VerticalUseCasePage page={page} />;
}
