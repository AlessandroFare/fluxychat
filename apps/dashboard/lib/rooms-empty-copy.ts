export function roomsListEmptyCopy(hasSessionJwt: boolean): {
  title: string;
  description: string;
} {
  if (!hasSessionJwt) {
    return {
      title: "Connect a session",
      description:
        "Paste a member or admin JWT from Projects or Onboarding to list rooms.",
    };
  }
  return {
    title: "No rooms yet",
    description:
      "Create your first room to start chatting. Each room holds its own history and members.",
  };
}
