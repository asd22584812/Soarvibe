/**
 * Style Engine v1.1 — score/rank/filter only (no POI creation).
 * Run: node scripts/test-style-engine-v1.mjs
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
  const sandbox = { console, window: {}, globalThis: {}, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  sandbox.SOARVIBE_TRAVEL_TIME_ENGINE = {
    estimateTransferMinutes: function () {
      return { estimatedMinutes: 15, source: 'stub' };
    }
  };
  [
    'itinerary-time-integrity.js',
    'itinerary-places-hours.js',
    'itinerary-destination-intelligence.js',
    'itinerary-guide-intelligence.js',
    'itinerary-route-duration.js',
    'itinerary-style-engine.js',
    'itinerary-planner-v2.js'
  ].forEach(function (f) {
    vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sandbox, { filename: f });
  });
  return sandbox;
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

const env = loadAll();
const SE = env.SOARVIBE_STYLE_ENGINE;
const P = env.SOARVIBE_PLANNER_V2;

assert(!!SE && !!P, 'modules loaded');
assert(SE.STYLE_KEYS.length === 7, '7 style keys');
assert(SE.canCreateContent === false, 'cannot create content');
assert(!!SE.QUALITY_WEIGHTS.foodie, 'quality weights');

console.log('\n=== No injection + social degrade ===');
const base = SE.buildGeminiSimulatedFixture('Tokyo', 'sightseeing', 3, {});
const beforeTitles = [];
(base.days || []).forEach(function (d) {
  (d.phases || []).forEach(function (ph) {
    (ph.items || []).forEach(function (it) { beforeTitles.push(it.title); });
  });
});
const applied = SE.applyStyleEngine(clone(base), { travelStyle: 'trendy', destination: '東京' });
const afterTitles = [];
(applied.hidden.days || []).forEach(function (d) {
  (d.phases || []).forEach(function (ph) {
    (ph.items || []).forEach(function (it) { afterTitles.push(it.title); });
  });
});
const created = afterTitles.filter(function (t) {
  return beforeTitles.indexOf(t) === -1 && !/返回|機場/.test(t);
});
assert(created.length === 0, 'no new POIs from Style Engine');
assert(applied.hidden.meta.styleEngine.socialLive === false, 'trendy socialLive=false');
assert(applied.hidden.meta.styleEngine.freshness === 'unknown', 'trendy freshness unknown');

console.log('\n=== Gemini-sim style differences (filter only) ===');
const reports = {};
for (const style of SE.STYLE_KEYS) {
  const gem = SE.buildGeminiSimulatedFixture('Tokyo', style, 5, {});
  const planned = await P.planHiddenItineraryAsync(gem, { destination: '東京', travelStyle: style }, {
    styleKey: style,
    applyStyleEngine: true,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    useFixtureResolver: false,
    reattachRoutes: false,
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 15, source: 'injected' };
    }
  });
  reports[style] = planned.hidden;
  assert(!(planned.repairs || []).some(function (r) { return /inject/i.test(String(r.type || '')); }), style + ' no inject');
}
assert(SE.overlapTitles(reports.sightseeing, reports.anime).ratio < 0.9, 'sightseeing vs anime differ');
assert(SE.overlapTitles(reports.foodie, reports.streetwear).ratio < 0.95, 'foodie vs streetwear differ');

console.log('\n=== Sapporo Gemini-sim styles ===');
for (const style of ['sightseeing', 'anime', 'streetwear', 'trendy']) {
  const gem = SE.buildGeminiSimulatedFixture('Sapporo', style, 5, {});
  const planned = await P.planHiddenItineraryAsync(gem, { destination: '札幌', travelStyle: style }, {
    styleKey: style,
    applyStyleEngine: true,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    useFixtureResolver: false,
    reattachRoutes: false,
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 15, source: 'injected' };
    }
  });
  assert((planned.hidden.days || []).length === 5, 'Sapporo ' + style + ' 5 days');
  assert(!(planned.repairs || []).some(function (r) { return /inject/i.test(String(r.type || '')); }), 'Sapporo ' + style + ' no inject');
}
assert(
  SE.overlapTitles(
    (await (async function () {
      return (
        await P.planHiddenItineraryAsync(
          SE.buildGeminiSimulatedFixture('Sapporo', 'sightseeing', 5, {}),
          { destination: '札幌', travelStyle: 'sightseeing' },
          {
            styleKey: 'sightseeing',
            applyStyleEngine: true,
            allowMapsJs: false,
            allowWorkerRoutes: false,
            useFixtureResolver: false,
            reattachRoutes: false,
            fetchRouteDuration: async function () {
              return { estimatedMinutes: 12, source: 'injected' };
            }
          }
        )
      ).hidden;
    })()),
    (await (async function () {
      return (
        await P.planHiddenItineraryAsync(
          SE.buildGeminiSimulatedFixture('Sapporo', 'anime', 5, {}),
          { destination: '札幌', travelStyle: 'anime' },
          {
            styleKey: 'anime',
            applyStyleEngine: true,
            allowMapsJs: false,
            allowWorkerRoutes: false,
            useFixtureResolver: false,
            reattachRoutes: false,
            fetchRouteDuration: async function () {
              return { estimatedMinutes: 12, source: 'injected' };
            }
          }
        )
      ).hidden;
    })())
  ).ratio < 1,
  'Sapporo sightseeing vs anime not forced identical by injection'
);

console.log('\n=== Wiring ===');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert(index.includes('itinerary-style-engine.js'), 'style script tagged');
assert(index.includes('applyStyleEngine: true'), 'applyStyleEngine wired');
assert(!index.includes('對齊 IG／小紅書爆款'), 'no IG boom claim');
assert(!index.includes('對齊 Threads 熱議'), 'no Threads claim');
assert(!(/\uFFFD/.test(index)), 'no U+FFFD');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
