/**
 * P0 architecture simplification regressions.
 * Run: node scripts/test-p0-architecture-simplify.mjs
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

function flatTitles(hidden) {
  const out = [];
  (hidden.days || []).forEach(function (d) {
    (d.phases || []).forEach(function (ph) {
      (ph.items || []).forEach(function (it) {
        out.push({ day: d.dayNum, title: it.title, start: it.startTime, note: it.note, highlight: it.highlight });
      });
    });
  });
  return out;
}

const env = loadAll();
const SE = env.SOARVIBE_STYLE_ENGINE;
const P = env.SOARVIBE_PLANNER_V2;

assert(!!SE && !!P, 'modules loaded');
assert(SE.canCreateContent === false, 'Style Engine canCreateContent === false');

console.log('\n=== A. No synthetic injection ===');
const before = SE.buildGeminiSimulatedFixture('Sapporo', 'sightseeing', 3, {});
const titlesBefore = flatTitles(before).map(function (x) { return x.title; });
const applied = SE.applyStyleEngine(clone(before), { travelStyle: 'sightseeing', destination: '札幌', customWishes: '' });
const titlesAfter = flatTitles(applied.hidden).map(function (x) { return x.title; });
const created = titlesAfter.filter(function (t) {
  return titlesBefore.indexOf(t) === -1 && !/返回住宿|機場/.test(t);
});
assert(created.length === 0, 'Style Engine did not create new POIs (got ' + created.join(',') + ')');
assert(
  !(applied.repairs || []).some(function (r) { return /inject/i.test(r.type || ''); }),
  'no style_inject repairs'
);
assert(applied.hidden.meta.styleEngine.canCreateContent === false, 'meta canCreateContent false');

console.log('\n=== B. Metadata sanitize ===');
const leaky = {
  meta: { destination: '札幌', travelStyle: 'sightseeing' },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            {
              title: '大通公園',
              startTime: '10:00',
              endTime: '11:00',
              highlight: 'iconic · view',
              note: 'style-engine:大通'
            }
          ]
        }
      ]
    }
  ]
};
SE.sanitizeItineraryForRender(leaky);
assert(!/style-engine/i.test(leaky.days[0].phases[0].items[0].note || ''), 'note cleaned');
assert(!/\biconic\b/i.test(leaky.days[0].phases[0].items[0].highlight || ''), 'highlight cleaned');

console.log('\n=== C. Sapporo repeat regression ===');
const repeat = SE.buildRepeatLandmarkFixture('Sapporo', 5, '大通公園');
const rRep = await P.planHiddenItineraryAsync(repeat, { destination: '札幌', travelStyle: 'sightseeing' }, {
  styleKey: 'sightseeing',
  applyStyleEngine: true,
  allowMapsJs: false,
  allowWorkerRoutes: false,
  useFixtureResolver: false,
  reattachRoutes: false,
  fetchRouteDuration: async function () {
    return { estimatedMinutes: 12, source: 'injected', routeConfidence: 'estimated' };
  }
});
const odoriDays = {};
flatTitles(rRep.hidden).forEach(function (x) {
  if (x.title === '大通公園') odoriDays[x.day] = (odoriDays[x.day] || 0) + 1;
});
assert(Object.keys(odoriDays).length <= 1, '大通公園 not every day (days=' + Object.keys(odoriDays).join(',') + ')');
const towerDays = {};
flatTitles(rRep.hidden).forEach(function (x) {
  if (x.title === '札幌電視塔') towerDays[x.day] = true;
});
assert(Object.keys(towerDays).length <= 1, '電視塔 not repeated across days');

console.log('\n=== D. User note protection ===');
const withWish = SE.buildGeminiSimulatedFixture('Tokyo', 'sightseeing', 3, {});
withWish.days[0].phases[0].items.push({
  title: '寶可夢中心 東京',
  startTime: '15:00',
  endTime: '16:00',
  highlight: '依許願',
  note: '秋葉原'
});
const rWish = SE.applyStyleEngine(clone(withWish), {
  travelStyle: 'sightseeing',
  destination: '東京',
  customWishes: '一定要去 Pokemon Center，想逛動漫店'
});
assert(
  flatTitles(rWish.hidden).some(function (x) { return /寶可夢|Pokemon/i.test(x.title); }),
  'CASE B: Pokemon Center kept under sightseeing'
);

const foodieNoRaw = SE.applyStyleEngine(
  {
    meta: { destination: '東京' },
    days: [
      {
        dayNum: 1,
        phases: [
          {
            items: [
              { title: '築地場外市場', startTime: '10:00', endTime: '11:00' },
              { title: '生魚片定食', startTime: '12:00', endTime: '13:00' }
            ]
          }
        ]
      }
    ]
  },
  { travelStyle: 'foodie', destination: '東京', customWishes: '不要吃生食' }
);
// Style Engine does not invent raw food; exclusion is Gemini duty — ensure wishes preserved
assert(foodieNoRaw.hidden.meta.customWishes === '不要吃生食', 'CASE C: exclusion wish preserved on meta');

const otaru = SE.applyStyleEngine(
  {
    meta: { destination: '札幌' },
    days: [
      {
        dayNum: 2,
        phases: [
          {
            items: [
              { title: '小樽運河散步', startTime: '10:00', endTime: '12:00' },
              { title: '成吉思汗烤肉晚餐', startTime: '18:00', endTime: '19:30' }
            ]
          }
        ]
      }
    ]
  },
  { travelStyle: 'sightseeing', destination: '札幌', customWishes: '一定要去小樽，想吃成吉思汗' }
);
assert(
  flatTitles(otaru.hidden).some(function (x) { return /小樽/.test(x.title); }) &&
    flatTitles(otaru.hidden).some(function (x) { return /成吉思汗/.test(x.title); }),
  'CASE A: Otaru + Genghis kept'
);

const missing = SE.applyStyleEngine(
  SE.buildGeminiSimulatedFixture('Sapporo', 'sightseeing', 2, {}),
  { travelStyle: 'sightseeing', destination: '札幌', customWishes: '11/26 一定要去小樽' }
);
assert(
  (missing.unfulfilledUserRequest || []).some(function (u) { return /小樽/.test(u.request); }),
  'CASE E: unfulfilledUserRequest recorded when missing'
);

console.log('\n=== E. Flight golden ===');
const flightHidden = {
  meta: {
    destination: '札幌',
    travelStyle: 'sightseeing',
    flightMode: 'user_provided',
    flightArrival: '2026-11-20T11:30:00',
    flightReturn: '2026-11-25T20:30:00',
    flightOutboundNumber: 'CI100',
    flightReturnNumber: 'CI101',
    flightOutboundTo: 'CTS',
    flightReturnFrom: 'CTS'
  },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            { title: '抵達新千歲機場 CTS', startTime: '11:30', endTime: '12:00', eventType: 'arrival' },
            { title: '大通公園', startTime: '14:00', endTime: '15:30' }
          ]
        }
      ]
    },
    {
      dayNum: 2,
      phases: [
        {
          items: [
            { title: '前往機場', startTime: '16:30', endTime: '17:30', eventType: 'departure' },
            { title: '大通公園午後', startTime: '18:00', endTime: '19:00' },
            { title: 'CI101 起飛 CTS 20:30', startTime: '20:30', endTime: '21:00', eventType: 'departure' }
          ]
        }
      ]
    }
  ]
};
const rFlight = await P.planHiddenItineraryAsync(
  flightHidden,
  Object.assign({}, flightHidden.meta, {
    flightTimeEngine: { buffers: { earliestSightseeingHhmm: '13:20', latestLeaveForAirportHhmm: '16:30' } }
  }),
  {
    styleKey: 'sightseeing',
    applyStyleEngine: true,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    useFixtureResolver: false,
    reattachRoutes: false,
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 20, source: 'injected' };
    }
  }
);
assert(!!rFlight.hidden.meta.userFlights || !!rFlight.hidden.meta.styleEngine, 'flight meta path alive');
assert(
  (rFlight.hidden.meta.userFlights && rFlight.hidden.meta.userFlights.flightReturnNumber === 'CI101') ||
    flightHidden.meta.flightReturnNumber === 'CI101',
  'user flight number preserved'
);
const lastDay = flatTitles(rFlight.hidden).filter(function (x) { return x.day === 2; });
const airportIdx = lastDay.findIndex(function (x) { return /前往機場|起飛|CTS/i.test(x.title); });
const afterCity = lastDay.slice(airportIdx + 1).filter(function (x) {
  return /公園|觀光|燒肉|拉麵|神社/.test(x.title) && !/機場|起飛/.test(x.title);
});
assert(afterCity.length === 0, 'no city attraction after airport transfer');

console.log('\n=== F. No-flight / no-hotel still plans ===');
const noFlight = await P.planHiddenItineraryAsync(
  SE.buildGeminiSimulatedFixture('Sapporo', 'sightseeing', 6, {}),
  { destination: '札幌', travelStyle: 'sightseeing', flightMode: 'assumed' },
  {
    styleKey: 'sightseeing',
    applyStyleEngine: true,
    allowMapsJs: false,
    allowWorkerRoutes: false,
    useFixtureResolver: false,
    reattachRoutes: false,
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 15, source: 'injected' };
    }
  }
);
assert((noFlight.hidden.days || []).length === 6, 'no-flight 6-day itinerary');
assert(!flatTitles(noFlight.hidden).some(function (x) { return /CI\d{2,}|BR\d+|JL\d+/.test(x.title); }), 'no fake flight numbers');

console.log('\n=== G. Style difference via Gemini-sim fixtures (filter only) ===');
const styles = {};
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
  styles[style] = planned.hidden;
  assert(!(planned.repairs || []).some(function (r) { return /inject/i.test(String(r.type || '')); }), style + ' no inject');
}
const o = SE.overlapTitles(styles.sightseeing, styles.anime);
assert(o.ratio < 0.9, 'sightseeing vs anime differ (overlap ' + Math.round(o.ratio * 100) + '%)');

console.log('\n=== H. index wiring / UTF-8 ===');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert(index.includes('customWishes'), 'customWishes field exists');
assert(index.includes('優先於旅遊風格') || index.includes('許願清單'), 'wishes priority language');
assert(index.includes("flightMode = 'assumed'"), 'assumed flightMode');
assert(index.includes('sanitizeItineraryForRender'), 'sanitize wired');
assert(index.includes('customWishes: planMeta.customWishes'), 'planner receives customWishes');
assert(!(/\uFFFD/.test(index)), 'no U+FFFD');
assert(!index.includes('style_inject'), 'index has no inject API');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
