import { SignIn } from "@clerk/nextjs";
import { MarketingShell } from "@/app/components/marketing-shell";
import { clerkAuthAppearance } from "@/lib/clerk-copy";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <MarketingShell className="flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={clerkAuthAppearance}
      />
    </MarketingShell>
  );
}
