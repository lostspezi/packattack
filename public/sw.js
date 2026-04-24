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

// Explicit pass-through. Without a fetch listener the browser still passes
// requests to the network, but having one makes the no-intercept contract
// explicit and avoids edge-case behavior in some Chromium builds.
self.addEventListener("fetch", () => {
  return;
});

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
    icon: payload.icon || "/icon.png",
    badge: "/icon.png",
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
