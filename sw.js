const CACHE_NAME = 'horquilla-cache-v1';
const assets = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './datos.json',
  './musica.mp3',
  './manifest.json'
];

// Instalación del Service Worker y guardado en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// Interceptar peticiones para que funcione offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});