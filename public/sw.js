/* PACKATTACK Service Worker — handles Web Push notifications.
 *
 * Intentionally lightweight: no skipWaiting / clients.claim so an updated
 * SW takes effect on the next page load instead of grabbing live tabs
 * mid-session (which can break Next.js RSC prefetches).
 */

self.addEventListener("install", () => {
  // Default lifecycle — wait for old SW to be released.
});

self.addEventListener("activate", () => {
  // No clients.claim; controller stays with the previous SW for current tabs.
});

// No fetch listener registered: without one, the browser bypasses the SW
// entirely for every navigation/asset, which is exactly what we want here.
// (A no-op listener still marks each request as SW-handled and can cause
// odd cache behavior in Firefox.)

self.addEventListener("push", (event) => {
  let payload = { title: "PACKATTACK", body: "", url: "/dashboard" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // Non-JSON payload — fall back to defaults
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/favicon.png",
    badge: "/favicon.png",
    image: payload.image,
    data: { url: payload.url || "/dashboard" },
    tag: payload.tag,
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    })
  );
});
