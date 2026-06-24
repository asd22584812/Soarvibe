const CACHE_NAME = 'soarvibe-v102';
const STATIC_ASSETS = [
  './manifest.json',
  './city-journal-data.js',
  './bg.png',
  './soarvibe-logo.png',
  './assets/logo.png',
  './assets/city-journal/manifest.json',
  './assets/city-journal/placeholder-city-journal.jpg',
  './assets/city-journal/tokyo/tokyo-hero.jpg',
  './assets/city-journal/tokyo/tokyo-budget-cover.jpg',
  './assets/city-journal/tokyo/tokyo-sightseeing-cover.jpg',
  './assets/city-journal/tokyo/tokyo-trendy-cover.jpg',
  './assets/city-journal/tokyo/tokyo-food-cover.jpg',
  './assets/city-journal/tokyo/tokyo-instagram-cover.jpg',
  './assets/city-journal/tokyo/tokyo-anime-cover.jpg',
  './assets/city-journal/tokyo/tokyo-streetwear-cover.jpg',
  './assets/city-journal/tokyo/tokyo-anime-hero.jpg',
  './assets/city-journal/tokyo/akihabara-electric-town.jpg',
  './assets/city-journal/tokyo/nakano-broadway.jpg',
  './assets/city-journal/tokyo/gachapon-hall.jpg',
  './assets/city-journal/tokyo/ichiran-ramen.jpg',
  './assets/city-journal/tokyo/maid-cafe.jpg',
  './assets/city-journal/tokyo/japanese-curry.jpg',
  './assets/city-journal/tokyo/hotel-gracery.jpg',
  './assets/city-journal/tokyo/hostel-nui.jpg',
  './assets/city-journal/osaka/osaka-hero.jpg',
  './assets/city-journal/osaka/osaka-budget-cover.jpg',
  './assets/city-journal/osaka/osaka-sightseeing-cover.jpg',
  './assets/city-journal/osaka/osaka-trendy-cover.jpg',
  './assets/city-journal/osaka/osaka-food-cover.jpg',
  './assets/city-journal/osaka/osaka-instagram-cover.jpg',
  './assets/city-journal/osaka/osaka-anime-cover.jpg',
  './assets/city-journal/osaka/osaka-streetwear-cover.jpg',
  './assets/city-journal/kyoto/kyoto-hero.jpg',
  './assets/city-journal/kyoto/kyoto-budget-cover.jpg',
  './assets/city-journal/kyoto/kyoto-sightseeing-cover.jpg',
  './assets/city-journal/kyoto/kyoto-trendy-cover.jpg',
  './assets/city-journal/kyoto/kyoto-food-cover.jpg',
  './assets/city-journal/kyoto/kyoto-instagram-cover.jpg',
  './assets/city-journal/kyoto/kyoto-anime-cover.jpg',
  './assets/city-journal/kyoto/kyoto-streetwear-cover.jpg',
  './assets/city-journal/seoul/seoul-hero.jpg',
  './assets/city-journal/seoul/seoul-budget-cover.jpg',
  './assets/city-journal/seoul/seoul-sightseeing-cover.jpg',
  './assets/city-journal/seoul/seoul-trendy-cover.jpg',
  './assets/city-journal/seoul/seoul-food-cover.jpg',
  './assets/city-journal/seoul/seoul-instagram-cover.jpg',
  './assets/city-journal/seoul/seoul-anime-cover.jpg',
  './assets/city-journal/seoul/seoul-streetwear-cover.jpg',
  './assets/city-journal/paris/paris-hero.jpg',
  './assets/city-journal/paris/paris-budget-cover.jpg',
  './assets/city-journal/paris/paris-sightseeing-cover.jpg',
  './assets/city-journal/paris/paris-trendy-cover.jpg',
  './assets/city-journal/paris/paris-food-cover.jpg',
  './assets/city-journal/paris/paris-instagram-cover.jpg',
  './assets/city-journal/paris/paris-anime-cover.jpg',
  './assets/city-journal/paris/paris-streetwear-cover.jpg',
  './assets/city-journal/london/london-hero.jpg',
  './assets/city-journal/london/london-budget-cover.jpg',
  './assets/city-journal/london/london-sightseeing-cover.jpg',
  './assets/city-journal/london/london-trendy-cover.jpg',
  './assets/city-journal/london/london-food-cover.jpg',
  './assets/city-journal/london/london-instagram-cover.jpg',
  './assets/city-journal/london/london-anime-cover.jpg',
  './assets/city-journal/london/london-streetwear-cover.jpg',
  './assets/city-journal/bangkok/bangkok-hero.jpg',
  './assets/city-journal/bangkok/bangkok-budget-cover.jpg',
  './assets/city-journal/bangkok/bangkok-sightseeing-cover.jpg',
  './assets/city-journal/bangkok/bangkok-trendy-cover.jpg',
  './assets/city-journal/bangkok/bangkok-food-cover.jpg',
  './assets/city-journal/bangkok/bangkok-instagram-cover.jpg',
  './assets/city-journal/bangkok/bangkok-anime-cover.jpg',
  './assets/city-journal/bangkok/bangkok-streetwear-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-hero.jpg',
  './assets/city-journal/hokkaido/hokkaido-budget-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-sightseeing-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-trendy-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-food-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-instagram-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-anime-cover.jpg',
  './assets/city-journal/hokkaido/hokkaido-streetwear-cover.jpg'
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
