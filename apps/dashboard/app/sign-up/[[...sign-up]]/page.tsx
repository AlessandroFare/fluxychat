import { SignUp } from "@clerk/nextjs";
import { MarketingShell } from "@/app/components/marketing-shell";
import { clerkAuthAppearance } from "@/lib/clerk-copy";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <MarketingShell className="flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/onboarding"
        appearance={clerkAuthAppearance}
      />
    </MarketingShell>
  );
}
