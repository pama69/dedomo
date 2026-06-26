// Dedomo Service Worker — Web Push handler
// Versione: 1.0

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Cancella ogni cache lasciata da Service Worker precedenti
      // (es. workbox/CRA o build Emergent) che servivano pagine vecchie
      // e costringevano a fare Ctrl+Shift+R a ogni deploy.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await clients.claim();
    })()
  );
});

// Questo SW non fa caching: lasciamo che le richieste passino sempre alla rete,
// così il browser riceve sempre l'ultima build senza hard refresh.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Dedomo", body: event.data?.text() ?? "" };
  }

  const title = data.title || "Dedomo";
  const options = {
    body: data.body || "",
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    data: { url: data.url || "/dashboard" },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Se l'app è già aperta, portala in primo piano
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
