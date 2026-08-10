/**
 * P1.1 Dynamic Destination Intelligence — global generalization tests.
 * Usage: node scripts/test-destination-intelligence-global.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadAll() {
  const context = { console, globalThis: {} };
  context.window = context.globalThis;
  vm.createContext(context);
  for (const name of [
    'itinerary-time-integrity.js',
    'itinerary-places-hours.js',
    'itinerary-destination-intelligence.js',
    'itinerary-guide-intelligence.js',
    'travel-time-engine.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, {
      filename: name
    });
  }
  return context.globalThis;
}

const g = loadAll();
const DI = g.SOARVIBE_DESTINATION_INTELLIGENCE;
const G = g.SOARVIBE_GUIDE_INTELLIGENCE;
const T = g.SOARVIBE_ITINERARY_TIME_INTEGRITY;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('OK:', msg);
    return;
  }
  failed += 1;
  console.error('FAIL:', msg);
}

// A: not dependent on hardcoded city pack as sole path
{
  const intel = DI.buildDestinationIntelligence('完全虛構小城XanaduTest', {
    dateStart: '2026-08-10',
    travelStyle: 'sightseeing',
    center: { lat: 40.0, lng: 10.0 }
  });
  assert(intel.unknownDestination === true, 'unknown destination still builds');
  assert(intel.districts.length >= 3, 'unknown has synthetic districts');
  assert(!!intel.cityScale && !!intel.transitCharacter, 'unknown has scale+transit');
}

// Hierarchy
{
  const jp = DI.resolveLocationHierarchy('日本', {});
  assert(jp.level === 'country', 'Japan is country-level');
  const sap = DI.resolveLocationHierarchy('札幌', {});
  assert(sap.level === 'city' && sap.region === '北海道', 'Sapporo city under Hokkaido');
  const hok = DI.resolveLocationHierarchy('北海道', {});
  assert(hok.level === 'region' || hok.region === '北海道', 'Hokkaido region');
}

// Country strategy
{
  const jp7 = DI.buildDestinationIntelligence('日本', { tripDays: 7, dateStart: '2026-08-01' });
  assert(jp7.regionalStrategy.mode === 'multi_city', 'Japan 7d multi-city strategy');
  assert(jp7.regionalStrategy.maxHubs <= 3, 'Japan 7d max hubs <= 3: ' + jp7.regionalStrategy.maxHubs);
  assert(jp7.regionalStrategy.hubs.length <= jp7.regionalStrategy.maxHubs, 'hubs capped');
  const usa5 = DI.buildDestinationIntelligence('美國', { tripDays: 5 });
  assert(usa5.regionalStrategy.maxHubs <= 2, 'USA short trip limited hubs');
}

// Curated is enhancement only
{
  const sap = DI.buildDestinationIntelligence('札幌', { dateStart: '2026-08-10' });
  assert(sap.curatedEnhancement === true, 'Sapporo gets curated enhancement');
  const mel = DI.buildDestinationIntelligence('墨爾本', { dateStart: '2026-08-10' });
  assert(mel.curatedEnhancement === false, 'Melbourne has no curated pack');
  assert(mel.districts.length >= 3, 'Melbourne still has districts');
}

// Unknown destination golden set (no curated)
const UNKNOWN = ['名古屋', '濟州', '墨爾本', '里斯本', '溫哥華'];
UNKNOWN.forEach((dest) => {
  const intel = DI.buildDestinationIntelligence(dest, {
    dateStart: '2026-03-15',
    tripDays: 4,
    travelStyle: 'sightseeing'
  });
  assert(intel.districts.length >= 3, dest + ' districts');
  assert(['compact', 'medium', 'large', 'mega', 'regional'].includes(intel.cityScale), dest + ' scale');
  assert(!!intel.transitCharacter, dest + ' transit');
  assert(!!intel.seasonalContext && intel.seasonalContext.season !== 'unknown', dest + ' season');
  const guided = G.optimizeHidden(
    {
      days: [
        {
          dayNum: 1,
          phases: [
            {
              label: '下午',
              items: [
                { title: dest + '中心散步', startTime: '14:00', endTime: '15:30' },
                { title: '午餐', startTime: '12:00', endTime: '13:00' },
                { title: '返回飯店休息', startTime: '20:00', endTime: '20:25' }
              ]
            }
          ]
        }
      ],
      meta: {}
    },
    { destination: dest, styleKey: 'sightseeing', dateStart: '2026-03-15' }
  );
  assert(typeof guided.guideScore === 'number', dest + ' guide score');
  assert(T.assertChronological(
    guided.hidden.days[0].phases.flatMap((p) => p.items || [])
  ), dest + ' chronological after optimize');
});

// 15 destination generalization
const FIFTEEN = [
  '札幌', '東京', '名古屋', '首爾', '釜山', '濟州', '曼谷', '新加坡',
  '紐約', '洛杉磯', '巴黎', '倫敦', '羅馬', '雪梨', '墨爾本'
];
const genResults = [];
FIFTEEN.forEach((dest) => {
  const t0 = Date.now();
  const intel = DI.buildDestinationIntelligence(dest, {
    dateStart: '2026-09-01',
    tripDays: 5,
    travelStyle: 'sightseeing'
  });
  const ms = Date.now() - t0;
  genResults.push({
    dest,
    districts: intel.districts.length,
    scale: intel.cityScale,
    transit: intel.transitCharacter,
    curated: !!intel.curatedEnhancement,
    placesCap: intel.placesBudget.placesSearchCap,
    ms
  });
  assert(intel.districts.length >= 3, '15gen ' + dest + ' districts');
  assert(intel.placesBudget.placesSearchCap <= 25, '15gen ' + dest + ' places cap');
});
console.log('\n15-destination generalization:');
console.table(genResults);

// Cache
{
  DI.clearIntelligenceCache();
  const a = DI.buildDestinationIntelligence('巴黎', { dateStart: '2026-06-01' });
  assert(a.cacheHit === false, 'first paris miss');
  const b = DI.buildDestinationIntelligence('巴黎', { dateStart: '2026-06-01' });
  assert(b.cacheHit === true, 'second paris hit');
  const schema = DI.describeCacheSchema();
  assert(schema.schemaVersion >= 1 && schema.layers.base, 'cache schema documented');
}

// Clustering from POIs (not city-name hardcode)
{
  const pois = [
    { name: 'A', lat: 35.18, lng: 136.90, types: ['tourist_attraction'], rating: 4.5 },
    { name: 'B', lat: 35.181, lng: 136.901, types: ['restaurant'], rating: 4.4, category: 'food' },
    { name: 'C', lat: 35.17, lng: 136.91, types: ['shopping_mall'], rating: 4.2 },
    { name: 'D', lat: 35.20, lng: 136.88, types: ['park'], rating: 4.6 }
  ];
  const nagoya = DI.buildDestinationIntelligence('名古屋', {
    dateStart: '2026-08-10',
    pois
  }, { skipCache: true, pois });
  assert(nagoya.districts.some((d) => d.fromPlaces), 'Nagoya districts from POI cluster');
}

// Seasonal southern hemisphere
{
  const melWinterish = DI.deriveSeasonalContext('2026-07-15', -37.8);
  assert(melWinterish.season === 'winter', 'Melbourne July = winter (south)');
}

// Perf budgets 3/5/7/10
function profile(days) {
  const clock = G.createPerfClock();
  clock.start('total');
  clock.start('di');
  const intel = DI.buildDestinationIntelligence('里斯本', {
    tripDays: days,
    dateStart: '2026-05-01'
  });
  const diMs = clock.end('di');
  const hidden = {
    days: Array.from({ length: days }, (_, i) => ({
      dayNum: i + 1,
      phases: [
        {
          label: '下午',
          items: [
            { title: '里斯本中心', startTime: '10:00', endTime: '11:30' },
            { title: '午餐', startTime: '12:00', endTime: '13:00' },
            { title: '返回飯店休息', startTime: '20:00', endTime: '20:25' }
          ]
        }
      ]
    })),
    meta: {}
  };
  clock.start('guide');
  G.optimizeHidden(hidden, {
    destination: '里斯本',
    styleKey: 'sightseeing',
    dateStart: '2026-05-01',
    pack: intel
  });
  const guideMs = clock.end('guide');
  const total = clock.end('total');
  return {
    days,
    diMs,
    guideMs,
    totalCpuMs: total,
    placesCap: intel.placesBudget.placesSearchCap,
    poiCap: intel.placesBudget.poiCandidateCap
  };
}
const perf = {
  d3: profile(3),
  d5: profile(5),
  d7: profile(7),
  d10: profile(10)
};
console.log('\nPerf CPU (no live Places/Gemini):');
console.log(JSON.stringify(perf, null, 2));
assert(perf.d5.totalCpuMs < 2000, '5d CPU << 2s');
assert(perf.d10.placesCap <= 25, '10d places still capped');

// Guide still resolves via DI
{
  const pack = G.resolveDestinationPack('名古屋', { dateStart: '2026-08-10' });
  assert(pack.city === '名古屋' || pack.cityLabel === '名古屋', 'guide resolve uses DI');
  assert(pack.districts.length >= 3, 'guide pack has districts');
}

console.log('\nPassed:', passed, 'Failed:', failed);
if (failed) process.exit(1);
