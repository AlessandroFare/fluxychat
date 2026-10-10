/** Ably `Subscription`: `unsubscribe` / `off`, also callable for React effect cleanup. */
export interface FluxySubscription {
  (): void;
  unsubscribe(): void;
  off(): void;
}

export function fluxySubscription(stop: () => void): FluxySubscription {
  const sub = (() => {
    stop();
  }) as FluxySubscription;
  sub.unsubscribe = stop;
  sub.off = stop;
  return sub;
}
