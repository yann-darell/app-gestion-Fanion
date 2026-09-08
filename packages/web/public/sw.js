// Service Worker minimal pour validation PWA et installation sur écran d'accueil
const CACHE_NAME = 'fanion-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through pour préserver les requêtes Supabase et l'état en ligne
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
