import Link from "next/link";
import { Button } from "~/components/ui/button";
import { MARKETING_FINAL_CTA } from "@/lib/marketing-landing";
import { HOSTED_COPY, HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";

export function LandingFinalCtaSection() {
  const clerkOn = isClerkClientConfigured();

  return (
    <section
      className="border-b border-border px-4 py-16 sm:px-6"
      style={{ backgroundColor: "var(--am-whisper-gray)" }}
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{MARKETING_FINAL_CTA.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">{MARKETING_FINAL_CTA.body}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}>
                {MARKETING_FINAL_CTA.primaryLabel}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={MARKETING_FINAL_CTA.secondaryHref}>{MARKETING_FINAL_CTA.secondaryLabel}</a>
            </Button>
            <Button asChild variant="ghost">
              <Link href={HOSTED_PATHS.docs}>{HOSTED_COPY.viewDocs}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
