import { SignUp } from "@clerk/nextjs";
import { MarketingShell } from "@/app/components/marketing-shell";
import { clerkAuthAppearance } from "@/lib/clerk-copy";
import { CLERK_SIGN_UP_REDIRECT_URL } from "@/lib/clerk-redirects";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <MarketingShell className="flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={CLERK_SIGN_UP_REDIRECT_URL}
        fallbackRedirectUrl={CLERK_SIGN_UP_REDIRECT_URL}
        appearance={clerkAuthAppearance}
      />
    </MarketingShell>
  );
}
