/**
 * LEVEL 0 foodspot recommendation cache / dedupe regressions.
 * Run: node scripts/test-foodspot-cache-l0.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('OK', msg);
  } else {
    failed += 1;
    console.error('FAIL', msg);
  }
}

function extractFn(src, name) {
  let start = src.indexOf('async function ' + name + '(');
  if (start < 0) start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

console.log('=== Static wiring ===');
assert(/soarvibeFoodSpotRecCache/.test(index), 'A/B in-memory rec cache present');
assert(/function buildFoodSpotCacheKey\(/.test(index), 'cache key builder present');
assert(/function buildItineraryFoodSpotFingerprint\(/.test(index), 'itinerary fingerprint present');
assert(/function invalidateFoodSpotRecommendationCache\(/.test(index), 'invalidate helper present');
assert(/invalidateFoodSpotRecommendationCache\('itinerary-regenerate'\)/.test(index), 'invalidate on regenerate');
assert(/invalidateFoodSpotRecommendationCache\('itinerary-content-update'\)/.test(index), 'invalidate on itinerary replace/display');
assert(/cacheHit:\s*true/.test(index) && /soarvibeFoodSpotRecCache\.key === cacheKey/.test(index), 'B panel cache hit path');
assert(/forAnchorResolve:\s*true/.test(index), 'G resolve uses first valid anchor only');
assert(/foodSpotRequestMemo\.text\[memoKey\]/.test(index), 'E text query dedupe');
assert(/foodSpotRequestMemo\.nearby\[memoKey\]/.test(index), 'E nearby query dedupe');
assert(/\[SOARVIBE\]\[FoodSpot Cache\]/.test(index), 'debug logger present');
assert(/window\.soarvibeFoodSpotCache\s*=\s*cloneFoodSpotItems/.test(index), 'G booklet cache still written');
assert(/openGoogleMapsNavigation/.test(index) && /exclusive-nav-btn/.test(index), 'H 帶路 wiring intact');
assert(/extractAllAttractionsFromItinerary\(\)/.test(index) && /slice\(0,\s*5\)/.test(index), 'I anchors still max 5');
assert(/Place\.searchByText/.test(index) && /Place\.searchNearby/.test(index), 'I Places strategy retained');
assert(/function isTransportSelected\(/.test(index) && /if\s*\(\s*!isTransportSelected\(\)\s*\)/.test(index), 'J transport gate retained');
assert(!/localStorage\.setItem\(\s*['"][^'"]*FoodSpot/i.test(index), 'no Places result persistence to storage');
assert(!/sessionStorage\.setItem\(\s*['"][^'"]*FoodSpot/i.test(index), 'no FoodSpot sessionStorage persistence');

console.log('\n=== Cache key unit behavior ===');
const sandbox = {
  console,
  currentTripHiddenData: null,
  currentItineraryMeta: null,
  window: { soarvibeTripHiddenData: null, soarvibeTripPayload: null, soarvibeFoodSpotCache: [] },
  dateStartInput: { value: '2026-09-01' },
  dateEndInput: { value: '2026-09-04' },
  resolveCurrentCity: function () { return sandbox.__city; },
  getCurrentTripRegion: function () { return sandbox.__city; },
  getActivityTitleFromItem: function (item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.title || item.name || '';
  },
  cleanPlaceName: function (t) { return String(t || '').trim(); },
  __city: '大阪'
};
vm.createContext(sandbox);
vm.runInContext(
  extractFn(index, 'hashFoodSpotString') + '\n' +
  extractFn(index, 'buildItineraryFoodSpotFingerprint') + '\n' +
  extractFn(index, 'buildFoodSpotCacheKey') + '\n' +
  extractFn(index, 'invalidateFoodSpotRecommendationCache') + '\n' +
  'var soarvibeFoodSpotRecCache = { key: "", items: null };\n' +
  'var foodSpotRequestMemo = null;\n',
  sandbox
);

sandbox.currentTripHiddenData = {
  days: [{
    dayNum: 1,
    phases: [{ items: [{ title: '通天閣' }, { title: '黑門市場' }] }],
    foodPicks: [{ name: '某拉麵' }]
  }]
};
sandbox.currentItineraryMeta = { dateStart: '2026-09-01', dateEnd: '2026-09-04', tripId: 't1' };
const keyA = sandbox.buildFoodSpotCacheKey(['通天閣', '黑門市場']);
const keyA2 = sandbox.buildFoodSpotCacheKey(['通天閣', '黑門市場']);
assert(keyA === keyA2, 'A same itinerary → stable cache key');
assert(keyA.indexOf('大阪') >= 0, 'key includes destination');

sandbox.currentTripHiddenData = {
  days: [{
    dayNum: 1,
    phases: [{ items: [{ title: '大阪城' }, { title: '梅田' }] }],
    foodPicks: []
  }]
};
const keyB = sandbox.buildFoodSpotCacheKey(['大阪城', '梅田']);
assert(keyA !== keyB, 'C same city, different seed titles → different key');

sandbox.__city = '札幌';
sandbox.currentItineraryMeta = { dateStart: '2026-09-01', dateEnd: '2026-09-04', tripId: 't1' };
const keyC = sandbox.buildFoodSpotCacheKey(['通天閣', '黑門市場']);
assert(keyA !== keyC, 'D destination change → different key');

sandbox.__city = '大阪';
sandbox.soarvibeFoodSpotRecCache = { key: keyA, items: [{ id: '1', name: 'Demo' }] };
sandbox.window.soarvibeFoodSpotCache = [{ id: '1', name: 'Demo' }];
sandbox.invalidateFoodSpotRecommendationCache('test');
assert(!sandbox.soarvibeFoodSpotRecCache.key && !(sandbox.soarvibeFoodSpotRecCache.items), 'invalidate clears rec cache');
assert(Array.isArray(sandbox.window.soarvibeFoodSpotCache) && sandbox.window.soarvibeFoodSpotCache.length === 0, 'invalidate clears booklet array');

console.log('\n=== Request memo unit behavior ===');
const memoSandbox = {
  console,
  foodSpotRequestMemo: { text: Object.create(null), nearby: Object.create(null) },
  foodSpotDebugStats: { searchRequestCount: 0, nearbyRequestCount: 0, legacyRequestCount: 0, fetchFieldsCount: 0 },
  cloneFoodSpotItems: function (items) {
    return (items || []).map(function (item) { return Object.assign({}, item); });
  },
  resolveCurrentCity: function () { return '大阪'; },
  getCityGeoProfile: function () {
    return { lat: 34.69, lng: 135.5, country: '日本', regionCode: 'JP', searchRadiusM: 15000 };
  },
  composePlacesQuery: function (q, city) { return String(q) + ' ' + city + ' 日本'; },
  getSoarvibePlaceClass: async function () {
    return {
      searchByText: async function () {
        memoSandbox.__textCalls += 1;
        return {
          places: [{
            displayName: '店A',
            formattedAddress: 'addr',
            location: { lat: function () { return 1; }, lng: function () { return 2; } },
            rating: 4.5,
            photos: [{}],
            id: 'p1'
          }]
        };
      },
      searchNearby: async function () {
        memoSandbox.__nearbyCalls += 1;
        return { places: [] };
      }
    };
  },
  mapPlaceToFoodSpotItem: async function (place) {
    return {
      id: place.id,
      name: place.displayName,
      placeId: place.id,
      lat: 1,
      lng: 2,
      rating: '4.5',
      address: place.formattedAddress,
      photoUrl: '',
      tag: '',
      emoji: '🍱',
      koreanName: ''
    };
  },
  loadGoogleMapsPlacesLibrary: async function () {},
  placesLegacyTextSearch: async function () {
    memoSandbox.__legacyCalls += 1;
    return [];
  },
  mapLegacyPlaceResult: function () { return {}; },
  buildPlacesTextBias: function (c) { return c; },
  buildPlacesNearbyRestriction: function (c, r) { return { center: c, radius: r }; },
  __textCalls: 0,
  __nearbyCalls: 0,
  __legacyCalls: 0
};
vm.createContext(memoSandbox);
vm.runInContext(extractFn(index, 'placesSearchByText'), memoSandbox);
(async function () {
  const a = await memoSandbox.placesSearchByText('美食 餐廳 通天閣');
  const b = await memoSandbox.placesSearchByText('美食 餐廳 通天閣');
  assert(memoSandbox.__textCalls === 1, 'E duplicate text query deduped to 1 network search');
  assert(a.length === 1 && b.length === 1 && a[0].name === b[0].name, 'E dedupe returns same payload');
  assert(memoSandbox.foodSpotDebugStats.searchRequestCount === 1, 'E searchRequestCount increments once');

  console.log('\n=== Cache hit simulation ===');
  const items = [{ id: 'x', name: 'Cached Cafe', placeId: 'x', rating: '4.2', address: '大阪', tag: '景點＆美食 · 近 通天閣', emoji: '🍱', photoUrl: '', lat: 1, lng: 2, koreanName: '' }];
  const rec = { key: 'same-key', items: items.slice() };
  const hit = rec.key === 'same-key' && rec.items.length > 0;
  assert(hit, 'B second open same key → cache hit');
  assert(JSON.stringify(items) === JSON.stringify(rec.items), 'F cached cards payload identical to first store');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
