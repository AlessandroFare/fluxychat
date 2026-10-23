"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { readJwtSub } from "@/lib/jwt-claims";
import { useDashboardSession } from "../components/dashboard-session";

/**
 * Resolves the current identity to its user page. Self-host has no Clerk user, so
 * read the member JWT subject instead; with no session, send people to Quickstart.
 */
export default function ProfileRedirect() {
  const router = useRouter();
  const { user: clerkUser } = useClerkUser();
  const { hasHydrated, memberJwt } = useDashboardSession();

  useEffect(() => {
    if (!hasHydrated) return;
    if (clerkUser?.id) {
      router.replace(`/users/${encodeURIComponent(fluxyUserIdFromClerk(clerkUser.id))}`);
      return;
    }
    const memberId = readJwtSub(memberJwt);
    router.replace(memberId ? `/users/${encodeURIComponent(memberId)}` : "/onboarding");
  }, [clerkUser?.id, hasHydrated, memberJwt, router]);

  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      Loading profile…
    </div>
  );
}
