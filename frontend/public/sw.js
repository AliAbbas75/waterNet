/* WaterNet push service worker.
 *
 * Deliberately tiny: it shows what the server sent and routes the click. No
 * caching or offline behaviour, because a stale shell served from a worker is
 * exactly the "deploy didn't take" failure the nginx config already guards
 * against for index.html.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "WaterNet", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "WaterNet";
  const options = {
    body: payload.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    // Same category replaces rather than stacks, so a flapping device cannot
    // bury everything else under a column of near-identical notifications.
    tag: payload.category || "waternet",
    renotify: true,
    data: { url: payload.url || "/", category: payload.category || null }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse a tab that is already open rather than piling up new ones.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
