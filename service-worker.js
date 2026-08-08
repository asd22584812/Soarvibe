const CACHE_NAME = 'soarvibe-v147';
/* Phase 1C.1 cache bust ??travel ledger network-first */
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './feature-flags.js',
  './firebase-config.js',
  './firebase-init.js',
  './soarvibe-auth.js',
  './soarvibe-auth-ui.js',
  './city-shares-firestore.js',
  './city-shares-config.js',
  './city-shares-data.js',
  './city-shares-ui.js',
  './city-shares-ui.css',
  './city-journal-data.js',
  './city-journal-image-manifest.js',
  './city-journal-photo-scoring.js',
  './city-journal-image-library.js',
  './city-journal-caption.js',
  './travel-ledger.css',
  './travel-ledger-config.js',
  './travel-ledger-forex.js',
  './travel-ledger-data.js',
  './travel-ledger-ui.js',
  './assets/city-journal/manifest.json',
  './assets/city-journal/placeholder-city-journal.svg',
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
  './assets/city-journal/tokyo/hotel-gracery.jpg',
  './assets/city-shares/tokyo/tokyo-akihabara-radio-kaikan-001-exterior-0.jpg',
  './assets/city-shares/tokyo/tokyo-nakano-broadway-001-exterior-0.jpg',
  './assets/city-shares/tokyo/tokyo-sensoji-001-landmark-0.jpg',
  './assets/city-shares/tokyo/tokyo-shinjuku-gyoen-001-landmark-0.jpg'
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

function isTravelLedgerAsset(url) {
  var path = url.pathname;
  return (
    /\/travel-ledger(-(config|forex|data|ui))?\.js$/i.test(path) ||
    /\/travel-ledger\.css$/i.test(path) ||
    /\/index\.html$/i.test(path)
  );
}

function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then(function (response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (fallbackUrl) return caches.match(fallbackUrl);
        return undefined;
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var networkPromise = fetch(request)
      .then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(function () {
        return cached;
      });
    return cached || networkPromise;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isHtmlRequest(request, url) || isTravelLedgerAsset(url)) {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
