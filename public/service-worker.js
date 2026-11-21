'use strict';

const CACHE_NAME = 'farzin-static-v1';
const STATIC_ASSETS = [
  '/app-icon.svg',
  '/asset-catalog.js',
  '/asset-icons.js',
  '/boot.css',
  '/boot.js',
  '/board.js',
  '/board-config.js',
  '/app.js',
  '/manifest.webmanifest',
  '/login.css',
  '/login.js',
  '/pwa.js',
  '/quote-pricing.js',
  '/style.css'
];
const APP_SHELL = ['/board', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(STATIC_ASSETS);
    for (const url of APP_SHELL) {
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (response.ok && response.type !== 'opaqueredirect') await cache.put(url, response);
      } catch {}
    }
  }));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  const network = fetch(request).then(async response => {
    const type = response.headers.get('Content-Type') || '';
    if (response.ok && /javascript|text\/css|image\/|application\/manifest\+json/.test(type)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(network.then(() => undefined, () => undefined));
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(request) || network;
  })());
});
