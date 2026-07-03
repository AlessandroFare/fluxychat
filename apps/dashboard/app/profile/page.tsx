"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";

export default function ProfileRedirect() {
  const router = useRouter();
  const { user: clerkUser } = useClerkUser();

  useEffect(() => {
    if (clerkUser?.id) {
      const fluxyId = fluxyUserIdFromClerk(clerkUser.id);
      router.replace(`/users/${encodeURIComponent(fluxyId)}`);
    } else {
      router.replace("/");
    }
  }, [clerkUser?.id, router]);

  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      Loading profile…
    </div>
  );
}
