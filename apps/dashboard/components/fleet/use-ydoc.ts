"use client";

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { useEffect, useRef, useState } from "react";

const DOC_NAME = "fluxy-driver-state";

export function useYDoc(ready: boolean) {
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<IndexeddbPersistence | null>(null);
  const [synced, setSynced] = useState(false);
  const [tripsMap, setTripsMap] = useState<Y.Map<unknown> | null>(null);
  const [gpsQueue, setGpsQueue] = useState<Y.Array<unknown> | null>(null);

  useEffect(() => {
    if (!ready) return;
    const doc = new Y.Doc();
    docRef.current = doc;

    const provider = new IndexeddbPersistence(DOC_NAME, doc);
    providerRef.current = provider;

    provider.on("synced", () => {
      setSynced(true);
      const tm = doc.getMap("trips");
      const gq = doc.getArray("gpsQueue");
      const vm = doc.getMap("vehicle");
      setTripsMap(tm);
      setGpsQueue(gq);
      (window as any).__Y_DOC = doc;
    });

    return () => {
      (window as any).__Y_DOC = undefined;
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
    };
  }, [ready]);

  return { doc: docRef, provider: providerRef, synced, tripsMap, gpsQueue };
}
