import { SignIn } from "@clerk/nextjs";
import { MarketingShell } from "@/app/components/marketing-shell";
import { clerkAuthAppearance } from "@/lib/clerk-copy";
import { CLERK_SIGN_IN_REDIRECT_URL } from "@/lib/clerk-redirects";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <MarketingShell className="flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={CLERK_SIGN_IN_REDIRECT_URL}
        fallbackRedirectUrl={CLERK_SIGN_IN_REDIRECT_URL}
        appearance={clerkAuthAppearance}
      />
    </MarketingShell>
  );
}
