'use strict';

const CACHE_NAME = 'farzin-static-v11';
const STATIC_ASSETS = [
  '/app-icon.svg',
  '/asset-catalog.js',
  '/asset-icons.js',
  '/boot.css',
  '/boot.js',
  '/board.css',
  '/board.js',
  '/board-config.css',
  '/board-config.js',
  '/design-system.css',
  '/app.js',
  '/manifest.webmanifest',
  '/login.css',
  '/login.js',
  '/pwa.js',
  '/quote-pricing.js',
  '/style.css',
  '/ui-components.js'
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

  const isStaticAsset = /\.(css|js|png|svg|ico|webmanifest)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      const type = response.headers.get('Content-Type') || '';
      if (response.ok && /javascript|text\/css|image\/|application\/manifest\+json/.test(type)) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
