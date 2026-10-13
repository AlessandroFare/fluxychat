export function hasOtherPresenceMember(
  members: Array<{ userId?: string } | string> | null | undefined,
  selfId: string,
): boolean {
  const self = selfId.trim();
  if (!self || !Array.isArray(members)) return false;
  const ids = new Set(
    members
      .map((row) => (typeof row === "string" ? row : row.userId ?? "").trim())
      .filter(Boolean),
  );
  for (const id of ids) {
    if (id !== self) return true;
  }
  return false;
}
