import { VerticalUseCasePage, verticalPageMetadata } from "../landing/vertical-use-case";
import { verticalLandingBySlug } from "@/lib/vertical-landing";

const page = verticalLandingBySlug("pr-review")!;

export const metadata = verticalPageMetadata(page);

export default function PrReviewPage() {
  return <VerticalUseCasePage page={page} />;
}
