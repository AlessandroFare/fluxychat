import { VerticalUseCasePage, verticalPageMetadata } from "../landing/vertical-use-case";
import { verticalLandingBySlug } from "@/lib/vertical-landing";

const page = verticalLandingBySlug("incident")!;

export const metadata = verticalPageMetadata(page);

export default function IncidentPage() {
  return <VerticalUseCasePage page={page} />;
}
