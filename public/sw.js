/* PEAKER — minimal service worker. Auth/API/dashboard verisi cache'lenmez. */

const CACHE_NAME = "peaker-static-v2";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = ["/offline", "/icons/icon.svg", "/icons/icon-maskable.svg"];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function neverCache(url, method) {
  if (method !== "GET") return true;
  if (!sameOrigin(url)) return true;
  const path = url.pathname;
  if (path.startsWith("/api/")) return true;
  if (path.startsWith("/auth")) return true;
  if (path.includes("/exports/")) return true;
  if (path.endsWith(".csv")) return true;
  if (path.includes("realtime")) return true;
  if (path.startsWith("/_next/data/")) return true;
  return false;
}

function staticAsset(path) {
  return path.startsWith("/_next/static/") || path.startsWith("/icons/") || path === "/offline";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (neverCache(url, request.method)) {
    return;
  }

  if (staticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
  }
});
