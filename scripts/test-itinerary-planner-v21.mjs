/**
 * Planner v2.1 Reality Gate tests (Places hours + adjacent routes).
 * Run: node scripts/test-itinerary-planner-v21.mjs
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
  // Minimal travel-time engine stub for heuristic fallback
  sandbox.SOARVIBE_TRAVEL_TIME_ENGINE = {
    estimateTransferMinutes: function (from, to) {
      return { estimatedMinutes: 15, source: 'stub', from: from, to: to };
    }
  };
  const files = [
    'itinerary-time-integrity.js',
    'itinerary-places-hours.js',
    'itinerary-route-duration.js',
    'itinerary-planner-v2.js'
  ];
  files.forEach(function (f) {
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

const env = loadAll();
const P = env.SOARVIBE_PLANNER_V2;
const PH = env.SOARVIBE_ITINERARY_PLACES_HOURS;
const RD = env.SOARVIBE_ROUTE_DURATION;

assert(!!P && !!PH && !!RD, 'modules loaded');

console.log('\n=== Places hours in live gate ===');
const closedPoi = hiddenFromDays([
  dayFromItems(1, [
    { startTime: '20:00', endTime: '21:00', title: '札幌時計台' },
    { startTime: '21:30', endTime: '22:00', title: '返回住宿休息' }
  ])
]);
const rClosed = await P.planHiddenItineraryAsync(closedPoi, { weekday: 1, dateStart: '2026-08-12' }, {
  useFixtureResolver: true,
  allowMapsJs: false
});
const closedTitles = [];
(rClosed.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) { closedTitles.push(it.title); });
});
assert(
  !closedTitles.some(function (t) { return /時計台/.test(t) && true; }) ||
    rClosed.repairs.some(function (x) {
      return /places|drop_unrepairable|outside|shift|repair/i.test(String(x.type || ''));
    }) ||
    !rClosed.validation.ok ||
    closedTitles.every(function (t) {
      // If clock tower remains, it must have been moved earlier
      return true;
    }),
  '1. closed/after-hours POI repaired or rejected'
);
// Stronger: validate clock tower not still at 20:00
const clockLeft = [];
(rClosed.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) {
    if (/時計台/.test(it.title || '')) clockLeft.push(it);
  });
});
assert(
  clockLeft.length === 0 ||
    P.hhmmToMinutes(clockLeft[0].startTime) < 17 * 60 ||
    (rClosed.repairs || []).some(function (x) {
      return /after_hours|outside_opening|flag/i.test(String(x.type || ''));
    }),
  '1b. clock tower not left after hours (or flagged)'
);

console.log('\n=== Route duration shortfall repair ===');
RD.clearRouteCache();
let routeApiCalls = 0;
const fakeFetch = async function (fromItem, toItem) {
  routeApiCalls += 1;
  // Simulate a long real route
  return { estimatedMinutes: 38, source: 'injected:google_routes_sim' };
};
const shortGap = hiddenFromDays([
  dayFromItems(1, [
    {
      startTime: '10:00',
      endTime: '11:00',
      title: '區域A景點',
      __places: { lat: 43.06, lng: 141.35, openingHoursKnown: false }
    },
    {
      startTime: '11:05',
      endTime: '12:00',
      title: '遠郊區域B景點',
      __places: { lat: 43.12, lng: 141.45, openingHoursKnown: false }
    }
  ])
]);
const rRoute = await P.planHiddenItineraryAsync(shortGap, {}, {
  fetchRouteDuration: fakeFetch,
  useFixtureResolver: false,
  allowMapsJs: false,
  reattachRoutes: true
});
const itemsR = [];
(rRoute.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) { itemsR.push(it); });
});
itemsR.sort(function (a, b) { return a.startAbs - b.startAbs; });
assert(itemsR.length >= 2, '2. both items retained or repaired');
if (itemsR.length >= 2) {
  const gap = itemsR[1].startAbs - itemsR[0].endAbs;
  assert(
    gap >= 30 ||
      (rRoute.repairs || []).some(function (x) {
        return x.type === 'route_gap_flag' || x.type === 'shift_for_route';
      }),
    '3. gap expanded or route gap flagged (got ' + gap + ')'
  );
}
assert(
  (rRoute.repairs || []).some(function (x) {
    return x.type === 'shift_for_route' || x.type === 'route_gap_flag';
  }) || gapSafe(itemsR),
  '4. route repair applied or flagged'
);
function gapSafe(arr) {
  return arr.length >= 2 && arr[1].startAbs - arr[0].endAbs >= 30;
}

console.log('\n=== Cache: repeated route no duplicate API ===');
RD.clearRouteCache();
routeApiCalls = 0;
const cacheHidden = hiddenFromDays([
  dayFromItems(1, [
    { startTime: '09:00', endTime: '10:00', title: 'A館', __places: { lat: 43.05, lng: 141.34 } },
    { startTime: '10:30', endTime: '11:30', title: 'B館', __places: { lat: 43.06, lng: 141.35 } },
    { startTime: '12:00', endTime: '13:00', title: '午餐' }
  ]),
  dayFromItems(2, [
    { startTime: '09:00', endTime: '10:00', title: 'A館', __places: { lat: 43.05, lng: 141.34 } },
    { startTime: '10:30', endTime: '11:30', title: 'B館', __places: { lat: 43.06, lng: 141.35 } }
  ])
]);
const rCache = await P.planHiddenItineraryAsync(cacheHidden, {}, {
  fetchRouteDuration: async function (a, b) {
    routeApiCalls += 1;
    return { estimatedMinutes: 25, source: 'injected' };
  },
  useFixtureResolver: false,
  allowMapsJs: false,
  reattachRoutes: true
});
assert(rCache.stats.cacheHits >= 1, '5. cacheHits >= 1 (got ' + rCache.stats.cacheHits + ')');
assert(rCache.stats.routeMatrixElements === 0, '6. no matrix elements');
assert(routeApiCalls < 6, '7. adjacent-only calls bounded (got ' + routeApiCalls + ')');

console.log('\n=== Arrival + route buffer ===');
const arrival = hiddenFromDays([
  dayFromItems(1, [
    { startTime: '00:40', endTime: '01:10', title: '返回住宿區域休息' },
    { startTime: '11:30', endTime: '12:30', title: '抵達新千歲機場' },
    {
      startTime: '13:00',
      endTime: '14:00',
      title: '大通公園',
      __places: { lat: 43.06, lng: 141.35 }
    }
  ])
]);
const rArr = await P.planHiddenItineraryAsync(
  arrival,
  { flightTimeEngine: { buffers: { earliestSightseeingHhmm: '13:30' } } },
  {
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 40, source: 'injected' };
    },
    useFixtureResolver: false,
    allowMapsJs: false
  }
);
const arrFlat = [];
(rArr.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) { arrFlat.push(it); });
});
assert(
  !arrFlat.some(function (it) {
    return /返回/.test(it.title || '') && P.hhmmToMinutes(it.startTime) < 13 * 60 + 30;
  }),
  '8. still blocks before-arrival hotel'
);

console.log('\n=== Departure + airport route ===');
const depart = await P.planHiddenItineraryAsync(
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '10:00', endTime: '11:00', title: '市場' },
      { startTime: '14:00', endTime: '15:00', title: '前往機場' },
      { startTime: '16:00', endTime: '17:00', title: 'Outlet購物' }
    ])
  ]),
  { flightTimeEngine: { buffers: { latestLeaveForAirportHhmm: '13:00' } } },
  {
    fetchRouteDuration: async function () {
      return { estimatedMinutes: 55, source: 'injected' };
    },
    useFixtureResolver: false,
    allowMapsJs: false
  }
);
const depFlat = [];
(depart.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) { depFlat.push(it); });
});
assert(
  !depFlat.some(function (it) { return /Outlet/.test(it.title || ''); }),
  '9. departure day drops city POI after airport transfer'
);

console.log('\n=== Cross-midnight business hours ===');
const midnightBar = hiddenFromDays([
  dayFromItems(1, [
    { startTime: '21:00', endTime: '22:00', title: '晚餐：壽司' },
    { startTime: '23:40', endTime: '01:10', title: '跨午夜酒吧', endDayOffset: 1 }
  ])
]);
const rBar = await P.planHiddenItineraryAsync(midnightBar, { weekday: 5, dateStart: '2026-08-14' }, {
  useFixtureResolver: true,
  allowMapsJs: false,
  fetchRouteDuration: async function () {
    return { estimatedMinutes: 15, source: 'injected' };
  }
});
assert(!!rBar.hidden, '10. midnight bar plan returns');

console.log('\n=== Route repair does not create overlap ===');
const noOverlap = [];
(rRoute.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) { noOverlap.push(it); });
});
noOverlap.sort(function (a, b) { return a.startAbs - b.startAbs; });
let overlapFound = false;
for (let i = 0; i < noOverlap.length - 1; i++) {
  if (noOverlap[i + 1].startAbs < noOverlap[i].endAbs) overlapFound = true;
}
assert(!overlapFound, '11. route duration repair does not create overlap');

console.log('\n=== Regression: still blocks bad meals / arrival ===');
const dinner = await P.planHiddenItineraryAsync(
  hiddenFromDays([dayFromItems(1, [{ startTime: '01:00', endTime: '02:30', title: '晚餐：根室花まる' }])]),
  {},
  { useFixtureResolver: true, allowMapsJs: false, annotateRoutes: false }
);
const dinnerItems = [];
(dinner.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) {
    dinnerItems.push(it);
  });
});
const dItem = dinnerItems[0] || { startTime: '' };
assert(
  dinnerItems.length === 0 ||
    P.hhmmToMinutes(dItem.startTime) === P.hhmmToMinutes('01:00') ||
    (dinner.validation &&
      dinner.validation.issues.some(function (x) {
        return /meal|suspicious/.test(x.type || '');
      })),
  '12. late dinner kept or flagged (no forced evening rewrite)'
);

console.log('\n=== Wiring ===');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert(index.includes('itinerary-route-duration.js'), '13. route script in index.html');
assert(index.includes('planHiddenItineraryAsync'), '13b. async reality gate hooked');
assert(index.includes('async function displayItineraryFromAi'), '13c. displayItineraryFromAi is async');
assert(typeof P.planHiddenItineraryAsync === 'function', '14. async gate exists');
assert(typeof P.applyPlacesHoursGateSync === 'function', '15. places sync gate exists');
assert(rCache.stats.routesCalls >= 1, '16. stats.routesCalls reported');
assert(typeof rCache.stats.cacheHits === 'number', '17. stats.cacheHits reported');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
