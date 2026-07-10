/*
 * Minimal Web Push service worker for the FluxyChat dashboard showcase.
 * Displays incoming VAPID pushes sent by the Worker and focuses/opens the
 * dashboard when the notification is clicked.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "FluxyChat";
  const options = {
    body: payload.body || "You have a new message.",
    icon: payload.icon || "/fluxychat-icon.svg",
    badge: payload.badge || "/fluxychat-icon.svg",
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
