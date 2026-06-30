const CACHE_NAME = 'soarvibe-v111';
const STATIC_ASSETS = [
  './manifest.json',
  './city-journal-data.js',
  './city-journal-image-manifest.js',
  './city-journal-photo-scoring.js',
  './city-journal-image-library.js',
  './city-journal-caption.js',
  './assets/city-journal/manifest.json',
  './assets/city-journal/placeholder-city-journal.jpg',
  './cover-photos/vietnam.jpg',
  './cover-photos/default.jpg',
  './assets/city-journal/tokyo/tokyo-hero.jpg',
  './assets/city-journal/tokyo/tokyo-anime-hero.jpg',
  './assets/city-journal/tokyo/tokyo-anime-cover.jpg',
  './assets/city-journal/tokyo/akihabara-electric-town.jpg',
  './assets/city-journal/tokyo/nakano-broadway.jpg',
  './assets/city-journal/tokyo/gachapon-hall.jpg',
  './assets/city-journal/tokyo/ichiran-ramen.jpg',
  './assets/city-journal/tokyo/maid-cafe.jpg',
  './assets/city-journal/tokyo/japanese-curry.jpg',
  './assets/city-journal/tokyo/hotel-gracery.jpg'
];

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        STATIC_ASSETS.map(function (url) {
          return cache.add(url).catch(function () {
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key.startsWith('soarvibe-') && key !== CACHE_NAME;
        }).map(function (key) {
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
