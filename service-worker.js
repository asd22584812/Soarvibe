const CACHE_NAME = 'soarvibe-v43';
const STATIC_ASSETS = [
  './manifest.json',
  './bg.png',
  './soarvibe-logo.png',
  './assets/logo.png',
  './cover-photos/tokyo.jpg',
  './cover-photos/osaka.jpg',
  './cover-photos/kyoto.jpg',
  './cover-photos/seoul.jpg',
  './cover-photos/bangkok.jpg',
  './cover-photos/okinawa.jpg',
  './cover-photos/hokkaido.jpg',
  './cover-photos/london.jpg',
  './cover-photos/paris.jpg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isHtmlRequest(request, url) {
  if (request.mode === 'navigate') return true;
  var path = url.pathname;
  return path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('/Soarvibe') || path.endsWith('/Soarvibe/');
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isHtmlRequest(request, url)) {
    event.respondWith(
      fetch(request).then(function (response) {
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      });
    })
  );
});
