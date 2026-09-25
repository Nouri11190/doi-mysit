// Bump this on every deploy that changes index.html/manifest/icons so old
// clients pick up the new version instead of serving a stale cached copy —
// exactly the kind of "why is it showing the old version" issue we hit
// earlier with browser caching. Network-first below already minimizes that
// risk, but bumping this forces a clean cache swap too.
const CACHE_VERSION = "doaf-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests (the app shell itself). API calls to
  // Unpaywall/Semantic Scholar/CORE/arXiv are cross-origin and are left
  // completely untouched here — they go straight to the network as normal,
  // so lookups always hit the live API and are never served stale from cache.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // Network-first for the app shell: always try to get the latest deployed
  // version when online, and only fall back to the cached copy if the
  // network request fails (i.e. actually offline).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
