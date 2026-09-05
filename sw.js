const CACHE = 'keke-pocket-8068a9de02f6';
const ASSETS = [
  './', './index.html', './style.css', './main.js', './manifest.webmanifest',
  './app/motion.js', './app/audio.js', './app/controls.js', './app/camera.js', './app/photos.js', './app/icons.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './dist/keke-lowpoly-300-tex512.glb',
  './node_modules/three/build/three.module.js', './node_modules/three/build/three.core.js',
  './node_modules/three/examples/jsm/loaders/GLTFLoader.js', './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',
];
const allowed = new Set(ASSETS.map((path) => new URL(path, self.registration.scope).href));
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('keke-pocket-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url); url.search = '';
  if (!allowed.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(url.href, response.clone());
      return response;
    } catch {
      return await cache.match(url.href) || Response.error();
    }
  })());
});
