/**
 * Modul: Service Worker für Offline-Fähigkeit & sofortige App-Updates (sw.js)
 * Zweck: Verhindert veraltete iOS-Safari-Standalone-Caches durch Network-First-Strategie
 *   bei Online-Verbindung und koordiniert kontrollierte Updates via SKIP_WAITING.
 * Verantwortlichkeit: Cache-Verwaltung pro Version, Bereinigung alter Caches und
 *   direkte Weiterleitung von version.json ohne Browser-Cache.
 * Sicherheits- & Stabilitätsrelevanz: Nur Same-Origin-GET-Anfragen werden gecacht;
 *   bei Offline-Betrieb dient der Cache als sicherer Fallback.
 */

const CACHE_NAME = "hvacr-cache-v1.1.0";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/css/global.css",
  "./assets/js/shared.js",
  "./assets/js/dashboard.js",
  "./apps/sensor/index.html",
  "./apps/sensor/style.css",
  "./apps/sensor/app.js",
  "./apps/waermeleistung/index.html",
  "./apps/waermeleistung/app.js",
  "./apps/rohrnetz/index.html",
  "./apps/rohrnetz/app.js",
  "./apps/kaeltemittel/index.html",
  "./apps/kaeltemittel/app.js",
  "./apps/taupunkt/index.html",
  "./apps/taupunkt/app.js",
  "./apps/mag/index.html",
  "./apps/mag/app.js",
  "./apps/luftkanal/index.html",
  "./apps/luftkanal/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache-Busting beim Pre-Cache, damit keine veralteten HTTP-Cache-Kopien gespeichert werden.
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          const response = await fetch(asset, { cache: "reload" });
          if (response.ok) {
            await cache.put(asset, response);
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Versionsdatei niemals cachen, damit Update-Prüfungen immer den Serverstand sehen.
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Network-First mit no-cache: Bei Empfang immer aktuelle Dateien, offline Cache-Fallback.
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        return new Response("Offline – Inhalt nicht im Cache.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
