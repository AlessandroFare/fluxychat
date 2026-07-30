const CACHE = "fluxy-driver-v1";
const GPS_SYNC = "gps-sync";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/driver", "/fleet", "/"]),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests for driver/fleet pages
  if (url.origin !== self.location.origin) return;

  // Only intercept navigation requests and fleet API calls
  if (event.request.mode === "navigate" && !url.pathname.startsWith("/driver")) return;
  if (event.request.mode !== "navigate" && !url.pathname.includes("/fleet/")) return;

  if (url.pathname.includes("/fleet/gps") && event.request.method === "POST") {
    event.respondWith(offlineGpsFallback(event));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() =>
        new Response("Offline", { status: 503, statusText: "Offline" }),
      );
    }),
  );
});

async function offlineGpsFallback(event) {
  try {
    return await fetch(event.request.clone());
  } catch {
    const clone = event.request.clone();
    const body = await clone.json();
    const db = await openDb();
    await db.put("gps_queue", { id: Date.now(), ...body, queuedAt: Date.now() });
    if ("sync" in self.registration) {
      await self.registration.sync.register(GPS_SYNC);
    }
    return new Response(JSON.stringify({ ok: true, queued: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === GPS_SYNC) {
    event.waitUntil(flushGpsQueue());
  }
});

async function flushGpsQueue() {
  const db = await openDb();
  const tx = db.transaction("gps_queue", "readwrite");
  const store = tx.objectStore("gps_queue");
  const all = await store.getAll();
  for (const item of all) {
    try {
      await fetch("/fleet/gps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      await store.delete(item.id);
    } catch { break; }
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("FluxyDriverOffline", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("gps_queue", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
