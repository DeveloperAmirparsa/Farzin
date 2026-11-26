'use strict';

const CACHE_NAME = 'farzin-static-v14';
const STATIC_ASSETS = [
  '/app-icon.svg',
  '/farzin-logo.png',
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
  '/smart-tv-utils.js',
  '/style.css',
  '/tgju-widget.js',
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
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  const isStaticAsset = /\.(css|js|png|svg|ico|webmanifest)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: false });
    const revalidate = fetch(request).then(response => {
      const type = response.headers.get('Content-Type') || '';
      if (response.ok && /javascript|text\/css|image\/|application\/manifest\+json/.test(type)) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(revalidate);
      return cached;
    }
    const fresh = await revalidate;
    if (fresh) return fresh;
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});
