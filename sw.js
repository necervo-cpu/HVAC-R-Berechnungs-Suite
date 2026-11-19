/**
 * Modul: Service Worker für Offline-Fähigkeit & sofortige App-Updates (sw.js)
 * Zweck: Verhindert veraltete iOS-Safari-Standalone-Caches durch Network-First-Strategie
 *   bei Online-Verbindung und koordiniert kontrollierte Updates via SKIP_WAITING.
 * Verantwortlichkeit: Cache-Verwaltung pro Version, Bereinigung alter Caches und
 *   direkte Weiterleitung von version.json ohne Browser-Cache.
 * Sicherheits- & Stabilitätsrelevanz: Nur Same-Origin-GET-Anfragen werden gecacht;
 *   bei Offline-Betrieb dient der Cache als sicherer Fallback.
 */

const CACHE_NAME = "hvacr-cache-v1.6.0";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/css/global.css",
  "./assets/js/shared.js",
  "./assets/js/dashboard.js",
];

const SUB_APP_ASSETS = [
  "./apps/heizkurve/index.html",
  "./apps/heizkurve/style.css",
  "./apps/heizkurve/app.js",
  "./apps/sensor/index.html",
  "./apps/sensor/style.css",
  "./apps/sensor/app.js",
  "./apps/waermeleistung/index.html",
  "./apps/waermeleistung/style.css",
  "./apps/waermeleistung/app.js",
  "./apps/rohrnetz/index.html",
  "./apps/rohrnetz/app.js",
  "./apps/kaeltemittel/index.html",
  "./apps/kaeltemittel/style.css",
  "./apps/kaeltemittel/app.js",
  "./apps/taupunkt/index.html",
  "./apps/taupunkt/app.js",
  "./apps/mag/index.html",
  "./apps/mag/app.js",
  "./apps/luftkanal/index.html",
  "./apps/luftkanal/app.js",
];

let subAppsPrefetched = false;

async function prefetchSubAppsInBackground() {
  if (subAppsPrefetched) return;
  subAppsPrefetched = true;

  try {
    const cache = await caches.open(CACHE_NAME);
    // Sequenziell im Leerlauf nachladen, damit auf iOS niemals die 6-Connection-Grenze blockiert wird.
    for (const asset of SUB_APP_ASSETS) {
      const existing = await cache.match(asset);
      if (!existing) {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch {
          // Einzelne Fehler beim Hintergrund-Prefetch ignorieren
        }
      }
    }
  } catch {
    subAppsPrefetched = false;
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Nur die 7 kleinen Core-Dateien beim Installieren vorab cachen (kein 22-Request-Stau auf iOS).
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          const response = await fetch(asset);
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
  } else if (event.data && event.data.type === "PREFETCH_SUB_APPS") {
    event.waitUntil(prefetchSubAppsInBackground());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isGoogleFont =
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com";

  if (url.origin !== self.location.origin && !isGoogleFont) return;

  // Google Fonts & Icons (.woff2): Cache-First mit Network-Fallback für 100 % Offline-Betrieb
  if (isGoogleFont) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === "opaque")) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Versionsdatei niemals cachen, damit Update-Prüfungen immer den Serverstand sehen.
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Stale-While-Revalidate: Sofortige Auslieferung aus dem Cache (0 ms Wartezeit auf iOS),
  // während im Hintergrund still auf neue Dateien geprüft und der Cache aktualisiert wird.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request, { cache: "no-cache" })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
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
        });

      if (cached) {
        event.waitUntil(networkFetch.catch(() => {}));
        return cached;
      }

      return networkFetch;
    })
  );
});
