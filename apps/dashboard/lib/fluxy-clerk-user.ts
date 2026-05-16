/** Map Clerk user id to a stable Fluxy `sub` for JWT minting (Worker userId). */
export function fluxyUserIdFromClerk(clerkUserId: string): string {
  return clerkUserId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}
