/**
 * Modul: Offline Service Worker für iOS Standalone PWA
 * Zweck: Garantiert unterbrechungsfreie Funktion im Heizungskeller und Technikräumen ohne Mobilfunkempfang
 * Strategie: Network-First für Navigation/HTML (damit Updates sofort ankommen) mit Cache-Fallback; Cache-First für statische Assets
 * Sicherheitsrelevanz: Rein lokaler Cache ohne externe Telemetrie
 */

const CACHE_NAME = 'hvac-r-suite-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Nur eigene Anfragen cachen
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html');

  if (isNavigation) {
    // Network-First für HTML: Frische Version laden, bei Offline-Zustand aus dem Cache bedienen
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-First für versionierte statische Assets (JS, CSS, Icons)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
