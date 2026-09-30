import { VerticalUseCasePage, verticalPageMetadata } from "../vertical-use-case";
import { verticalLandingBySlug } from "@/lib/vertical-landing";

const page = verticalLandingBySlug("pr-review")!;

export const metadata = verticalPageMetadata(page);

export default function PrReviewLandingPage() {
  return <VerticalUseCasePage page={page} />;
}
