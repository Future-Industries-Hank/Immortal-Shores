/* Immortal Shores PWA — network-first for API, cache shell for offline boot */
const CACHE = "immortal-shores-v15";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws") || url.pathname.startsWith("/health")) {
    return; // never cache API / live channels
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        if (event.request.method === "GET" && res.ok) {
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match("/")))
  );
});
