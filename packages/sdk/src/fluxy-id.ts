let fluxyIdSeq = 0;

/** Monotonic unique id — avoids duplicate React keys when Date.now() collides in tight loops. */
export function fluxyEntityId(prefix: string): string {
  fluxyIdSeq += 1;
  return `${prefix}_${Date.now()}_${fluxyIdSeq}`;
}
