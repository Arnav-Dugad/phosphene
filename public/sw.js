/*
 * PHOSPHENE's service worker: the observatory keeps working when the signal
 * drops. Pages are fetched network-first (so a deploy is seen at once) and
 * fall back to what this device already holds; hashed assets, fonts and
 * icons are served cache-first. Nothing here ever leaves the device.
 */
const VERSION = 'phosphene-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/favicon.svg', '/icons/icon-192.png', '/boot.js'];
const MAX_RUNTIME_ENTRIES = 160;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME_ENTRIES; i++) await cache.delete(keys[i]);
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Offline: this page if it was seen before, otherwise the shell, which routes on the client.
    return (await cache.match(request)) ?? (await cache.match('/')) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (/^\/(assets|fonts|icons)\//.test(url.pathname)) event.respondWith(cacheFirst(request));
});
