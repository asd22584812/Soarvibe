/**
 * Planner v2.2 — Google Routes Reality Layer tests (mocked; no live Google / deploy).
 * Run: node scripts/test-itinerary-planner-v22.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

function loadAll() {
  const sandbox = { console, window: {}, globalThis: {}, setTimeout, clearTimeout, fetch: undefined };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  sandbox.SOARVIBE_TRAVEL_TIME_ENGINE = {
    estimateTransferMinutes: function (from, to) {
      return { estimatedMinutes: 18, source: 'stub', from: from, to: to };
    }
  };
  [
    'itinerary-time-integrity.js',
    'itinerary-places-hours.js',
    'itinerary-route-duration.js',
    'itinerary-planner-v2.js'
  ].forEach(function (f) {
    vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sandbox, { filename: f });
  });
  return sandbox;
}

function dayFromItems(dayNum, items) {
  return {
    dayNum: dayNum,
    phases: [{ label: '全天', items: items.map(function (it) { return Object.assign({}, it); }) }]
  };
}

function hiddenFromDays(days, meta) {
  return { meta: meta || {}, days: days };
}

function flatDay(day) {
  const out = [];
  (day.phases || []).forEach(function (ph) {
    (ph.items || []).forEach(function (it) { out.push(it); });
  });
  out.sort(function (a, b) { return (a.startAbs || 0) - (b.startAbs || 0); });
  return out;
}

function makeCityDay(city, dayNum, coords) {
  // 5 stops → 4 adjacent legs
  return dayFromItems(dayNum, coords.map(function (c, i) {
    return {
      startTime: String(9 + i).padStart(2, '0') + ':00',
      endTime: String(9 + i).padStart(2, '0') + ':45',
      title: city + ' POI ' + (i + 1),
      eventType: i === 2 ? 'food' : 'attraction',
      __places: { lat: c[0], lng: c[1], placeId: 'ChIJ' + city + i, openingHoursKnown: false }
    };
  }));
}

const env = loadAll();
const P = env.SOARVIBE_PLANNER_V2;
const RD = env.SOARVIBE_ROUTE_DURATION;

assert(!!P && !!RD, 'modules loaded');
assert(typeof RD.defaultRouteCallCap === 'function', 'defaultRouteCallCap exported');
assert(RD.defaultRouteCallCap(3) === 24, '3-day cap = 24');
assert(RD.defaultRouteCallCap(5) === 40, '5-day cap = 40');
assert(RD.defaultRouteCallCap(7) === 56, '7-day cap = 56');
assert(RD.roundCoord(25.0339641) === RD.roundCoord(25.03396409), 'coord normalize');

console.log('\n=== Sapporo Golden: adjacent routes + no teleport + no overlap ===');
RD.clearRouteCache();
const sapporoCoords = {
  '札幌站': { lat: 43.0686, lng: 141.3508, placeId: 'ChIJsapporoStation' },
  '白色戀人公園': { lat: 43.0892, lng: 141.2705, placeId: 'ChIJshiroiKoibito' },
  '大通公園': { lat: 43.0605, lng: 141.3455, placeId: 'ChIJodoriPark' },
  '薄野': { lat: 43.0555, lng: 141.3533, placeId: 'ChIJsusukino' }
};
const routeTable = {
  '札幌站|白色戀人公園': 35,
  '白色戀人公園|大通公園': 40,
  '大通公園|薄野': 12,
  '新千歲機場|札幌住宿': 50
};
let googleCalls = 0;
const sapporoFetch = async function (fromItem, toItem) {
  googleCalls += 1;
  const key = (fromItem.title || '') + '|' + (toItem.title || '');
  const mins = routeTable[key] || 22;
  return {
    estimatedMinutes: mins,
    durationSeconds: mins * 60,
    source: 'google_routes',
    routeConfidence: 'verified',
    meters: mins * 400
  };
};

const sapporo = hiddenFromDays([
  dayFromItems(1, [
    {
      startTime: '11:30',
      endTime: '12:00',
      title: '新千歲機場',
      eventType: 'arrival',
      __places: { lat: 42.7752, lng: 141.6925, placeId: 'ChIJcts' }
    },
    {
      startTime: '12:10',
      endTime: '12:40',
      title: '札幌住宿',
      eventType: 'hotel',
      __places: { lat: 43.06, lng: 141.35, placeId: 'ChIJhotel' }
    },
    {
      startTime: '13:00',
      endTime: '14:00',
      title: '大通公園',
      __places: Object.assign({ openingHoursKnown: false }, sapporoCoords['大通公園'])
    }
  ]),
  dayFromItems(2, [
    {
      startTime: '09:00',
      endTime: '10:00',
      title: '札幌站',
      __places: Object.assign({ openingHoursKnown: false }, sapporoCoords['札幌站'])
    },
    {
      startTime: '10:10',
      endTime: '12:00',
      title: '白色戀人公園',
      __places: Object.assign({ openingHoursKnown: false }, sapporoCoords['白色戀人公園'])
    },
    {
      startTime: '12:20',
      endTime: '14:00',
      title: '大通公園',
      __places: Object.assign({ openingHoursKnown: false }, sapporoCoords['大通公園'])
    },
    {
      startTime: '14:10',
      endTime: '16:00',
      title: '薄野',
      __places: Object.assign({ openingHoursKnown: false }, sapporoCoords['薄野'])
    }
  ])
]);

const rSap = await P.planHiddenItineraryAsync(
  sapporo,
  {
    destination: '札幌',
    flightTimeEngine: { buffers: { earliestSightseeingHhmm: '13:20' } }
  },
  {
    fetchRouteDuration: sapporoFetch,
    useFixtureResolver: false,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    reattachRoutes: true
  }
);

assert(/^2\.2(\.\d+)?$/.test(String(rSap.hidden.meta.plannerV2.version || '')), 'planner version 2.2');
assert(rSap.stats.routeMatrixElements === 0, 'no NxN matrix');

const day2 = flatDay(rSap.hidden.days[1]);
assert(day2.length >= 4, 'day2 keeps major stops');
const titles = day2.map(function (x) { return x.title; }).join('>');
assert(/札幌站/.test(titles) && /白色戀人/.test(titles) && /大通/.test(titles) && /薄野/.test(titles), 'golden sequence present');

// No teleport: each adjacent gap >= route minutes (minus tiny float)
let teleport = false;
let overlap = false;
for (let i = 0; i < day2.length - 1; i++) {
  const a = day2[i];
  const b = day2[i + 1];
  if (b.startAbs < a.endAbs) overlap = true;
  const need = (a.__routeToNext && a.__routeToNext.estimatedMinutes) || 0;
  if (need && b.startAbs - a.endAbs < need - 1) teleport = true;
  assert(!!a.__routeToNext || i === day2.length - 1, 'leg has route metadata when expected');
  if (a.__routeToNext) {
    assert(a.__routeToNext.routeConfidence === 'verified', 'verified confidence on injected google');
    assert(a.__routeToNext.source === 'google_routes', 'source google_routes');
  }
}
assert(!overlap, 'no overlap after route repair');
assert(!teleport, 'no teleport vs verified route');

// Odori → Susukino should be short relative to Shiroi Koibito hop
const odori = day2.find(function (x) { return /大通/.test(x.title); });
assert(
  odori && odori.__routeToNext && odori.__routeToNext.estimatedMinutes <= 20,
  'Odori→Susukino short/local (' + (odori && odori.__routeToNext && odori.__routeToNext.estimatedMinutes) + ')'
);

const day1 = flatDay(rSap.hidden.days[0]);
const hotel = day1.find(function (x) { return /住宿/.test(x.title || ''); });
const sightseeing = day1.find(function (x) { return /大通/.test(x.title || ''); });
assert(
  !sightseeing || P.hhmmToMinutes(sightseeing.startTime) >= 13 * 60 + 20 ||
    (hotel && sightseeing && sightseeing.startAbs >= hotel.endAbs),
  'arrival day respects usable window / airport transfer'
);

console.log('\n=== Generic cities: Tokyo / Seoul / Bangkok / Sapporo ===');
const cities = {
  Tokyo: [[35.6812, 139.7671], [35.7148, 139.7967], [35.6595, 139.7005], [35.6586, 139.7454], [35.6762, 139.6503]],
  Seoul: [[37.5665, 126.978], [37.5796, 126.977], [37.5512, 126.9882], [37.5112, 127.098], [37.4979, 127.0276]],
  Bangkok: [[13.7563, 100.5018], [13.746, 100.534], [13.724, 100.534], [13.7466, 100.539], [13.73, 100.523]],
  Sapporo: [[43.068, 141.35], [43.055, 141.353], [43.0605, 141.345], [43.089, 141.27], [43.05, 141.34]]
};

for (const city of Object.keys(cities)) {
  RD.clearRouteCache();
  let calls = 0;
  const hidden = hiddenFromDays([makeCityDay(city, 1, cities[city])]);
  const r = await P.planHiddenItineraryAsync(hidden, { destination: city }, {
    fetchRouteDuration: async function () {
      calls += 1;
      return {
        estimatedMinutes: 25,
        source: 'google_routes',
        routeConfidence: 'verified'
      };
    },
    useFixtureResolver: false,
    allowMapsJs: false,
    allowWorkerRoutes: false
  });
  assert(r.stats.routeMatrixElements === 0, city + ' matrix=0');
  assert(calls <= 8, city + ' adjacent-only calls (' + calls + ')');
  const items = flatDay(r.hidden.days[0]);
  let ov = false;
  for (let i = 0; i < items.length - 1; i++) {
    if (items[i + 1].startAbs < items[i].endAbs) ov = true;
  }
  assert(!ov, city + ' no overlap');
}

console.log('\n=== Cache hit / API failure fallback / malformed / timeout / cap ===');
RD.clearRouteCache();
let n = 0;
const cacheHidden = hiddenFromDays([
  dayFromItems(1, [
    { startTime: '09:00', endTime: '10:00', title: 'A', __places: { lat: 35.68, lng: 139.76, placeId: 'ChIJa' } },
    { startTime: '10:30', endTime: '11:30', title: 'B', __places: { lat: 35.69, lng: 139.77, placeId: 'ChIJb' } }
  ]),
  dayFromItems(2, [
    { startTime: '09:00', endTime: '10:00', title: 'A', __places: { lat: 35.68, lng: 139.76, placeId: 'ChIJa' } },
    { startTime: '10:30', endTime: '11:30', title: 'B', __places: { lat: 35.69, lng: 139.77, placeId: 'ChIJb' } }
  ])
]);
const rCache = await P.planHiddenItineraryAsync(cacheHidden, {}, {
  fetchRouteDuration: async function () {
    n += 1;
    return { estimatedMinutes: 20, source: 'google_routes', routeConfidence: 'verified' };
  },
  useFixtureResolver: false,
  allowMapsJs: false,
  allowWorkerRoutes: false,
  reattachRoutes: true
});
assert(rCache.stats.cacheHits >= 1, 'cacheHits >= 1 (got ' + rCache.stats.cacheHits + ')');
assert(n <= 2, 'placeId cache collapses duplicate legs (calls=' + n + ')');

RD.clearRouteCache();
const rFail = await RD.resolveLegDuration(
  { title: 'X', __places: { lat: 35.68, lng: 139.76 } },
  { title: 'Y', __places: { lat: 35.69, lng: 139.77 } },
  {
    allowMapsJs: false,
    allowWorkerRoutes: false,
    fetchRouteDuration: async function () {
      throw new Error('boom');
    }
  }
);
assert(rFail.source === 'geo_haversine' || rFail.source === 'heuristic', 'API failure → fallback');
assert(rFail.routeConfidence === 'estimated', 'failure confidence estimated');

RD.clearRouteCache();
const rMalformed = await RD.resolveLegDuration(
  { title: 'X', __places: { lat: 35.68, lng: 139.76 } },
  { title: 'Y', __places: { lat: 35.69, lng: 139.77 } },
  {
    allowMapsJs: false,
    allowWorkerRoutes: false,
    fetchRouteDuration: async function () {
      return { ok: false };
    }
  }
);
assert(rMalformed.routeConfidence === 'estimated', 'malformed → estimated');

RD.clearRouteCache();
const rTimeout = await RD.resolveLegDuration(
  { title: 'X', __places: { lat: 35.68, lng: 139.76 } },
  { title: 'Y', __places: { lat: 35.69, lng: 139.77 } },
  {
    timeoutMs: 30,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    fetchRouteDuration: function () {
      return new Promise(function () { /* never resolves */ });
    }
  }
);
assert(!!rTimeout && rTimeout.estimatedMinutes > 0, 'timeout still returns estimate');
assert(rTimeout.routeConfidence === 'estimated', 'timeout confidence estimated');

RD.clearRouteCache();
let capped = 0;
const many = hiddenFromDays([
  makeCityDay('Cap', 1, cities.Tokyo),
  makeCityDay('Cap', 2, cities.Tokyo),
  makeCityDay('Cap', 3, cities.Tokyo)
]);
await P.planHiddenItineraryAsync(many, {}, {
  routeCallCap: 2,
  reattachRoutes: false,
  allowMapsJs: false,
  allowWorkerRoutes: false,
  useFixtureResolver: false,
  fetchRouteDuration: async function () {
    capped += 1;
    return { estimatedMinutes: 30, source: 'google_routes', routeConfidence: 'verified' };
  }
});
assert(capped <= 2, 'route call cap enforced (got ' + capped + ')');

console.log('\n=== Confidence + meal/midnight + opening conflict still plan ===');
RD.clearRouteCache();
const rEst = await RD.resolveLegDuration(
  { title: 'A', __places: { lat: 35.68, lng: 139.76 } },
  { title: 'B', __places: { lat: 35.681, lng: 139.761 } },
  { allowMapsJs: false, allowWorkerRoutes: false }
);
assert(rEst.routeConfidence === 'estimated', 'haversine estimated');
assert(RD.confidenceForSource('google_routes') === 'verified', 'google verified');
assert(RD.confidenceForSource('heuristic') === 'estimated', 'heuristic estimated');

const dinner = await P.planHiddenItineraryAsync(
  hiddenFromDays([dayFromItems(1, [{ startTime: '01:00', endTime: '02:00', title: '晚餐：壽司' }])]),
  {},
  {
    useFixtureResolver: true,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 10, source: 'google_routes', routeConfidence: 'verified' };
    }
  }
);
assert(P.hhmmToMinutes(dinner.hidden.days[0].phases[0].items[0].startTime) >= 17 * 60, 'meal+route still repairs dinner');

const midnight = await P.planHiddenItineraryAsync(
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '22:00', endTime: '23:00', title: '酒吧街', endDayOffset: 0 },
      { startTime: '23:50', endTime: '01:20', title: '跨午夜酒吧', endDayOffset: 1 }
    ])
  ]),
  { weekday: 5, dateStart: '2026-08-14' },
  {
    useFixtureResolver: true,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 12, source: 'google_routes', routeConfidence: 'verified' };
    }
  }
);
assert(!!midnight.hidden, 'midnight plan returns (no crash)');

console.log('\n=== Perf profile 3/5/7 day (mock) ===');
async function profileDays(dayCount) {
  RD.clearRouteCache();
  let calls = 0;
  const days = [];
  for (let d = 1; d <= dayCount; d++) {
    days.push(makeCityDay('Perf', d, cities.Tokyo));
  }
  const t0 = Date.now();
  const r = await P.planHiddenItineraryAsync(hiddenFromDays(days), { destination: 'Tokyo' }, {
    fetchRouteDuration: async function () {
      calls += 1;
      await new Promise(function (res) { setTimeout(res, 5); });
      return { estimatedMinutes: 22, source: 'google_routes', routeConfidence: 'verified' };
    },
    useFixtureResolver: false,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    concurrency: 3,
    reattachRoutes: true
  });
  const totalMs = Date.now() - t0;
  return {
    dayCount: dayCount,
    legs: (r.stats.legs || []).length,
    googleCalls: calls,
    googleRouteCalls: r.stats.googleRouteCalls,
    cacheHits: r.stats.cacheHits,
    fallbackCalls: r.stats.fallbackCalls,
    resolveLatencyMs: r.stats.resolveLatencyMs,
    totalMs: totalMs,
    matrix: r.stats.routeMatrixElements
  };
}

const p3 = await profileDays(3);
const p5 = await profileDays(5);
const p7 = await profileDays(7);
console.log('  profile', JSON.stringify({ p3: p3, p5: p5, p7: p7 }, null, 2));
assert(p3.matrix === 0 && p5.matrix === 0 && p7.matrix === 0, 'perf matrix always 0');
assert(p5.totalMs < 15000, '5-day mock total < 15s (got ' + p5.totalMs + 'ms)');
assert(p5.googleCalls <= RD.defaultRouteCallCap(5) * 2, '5-day google calls within soft budget');

console.log('\n=== Wiring / UTF-8 ===');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert(index.includes('allowWorkerRoutes: true'), 'index wires Worker routes');
assert(index.includes('/api/routes/duration') || index.includes('allowWorkerRoutes'), 'routes endpoint intended');
assert(!(/\uFFFD/.test(index)), 'no U+FFFD in index');
assert(index.includes('行程') || index.includes('返回'), 'Chinese intact');
const worker = readFileSync(join(root, 'worker/src/index.js'), 'utf8');
assert(worker.includes("/api/routes/duration"), 'Worker registers /api/routes/duration');
assert(worker.includes('handleRoutesDuration'), 'Worker imports handler');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('\nPERF_SUMMARY=' + JSON.stringify({ p3: p3, p5: p5, p7: p7 }));
