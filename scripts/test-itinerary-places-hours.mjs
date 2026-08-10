/**
 * Places Opening Hours + Final QA Gate (P0.5) regression tests.
 * Usage: node scripts/test-itinerary-places-hours.mjs
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
    'travel-time-engine.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, {
      filename: name
    });
  }
  return context.globalThis;
}

const g = loadAll();
const T = g.SOARVIBE_ITINERARY_TIME_INTEGRITY;
const P = g.SOARVIBE_ITINERARY_PLACES_HOURS;

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

function dayWith(items, dayNum) {
  return {
    dayNum: dayNum || 1,
    phases: [{ label: '晚上', items: items }]
  };
}

function attach(title, fixtureKey) {
  const raw = P.SAPPORO_FIXTURES[fixtureKey];
  const place = P.normalizePlaceRecord(raw);
  const item = { title: title, startTime: '19:00', endTime: '20:30' };
  P.attachPlacesMeta(item, place, { ok: true, confidence: 0.9 }, 'fixture');
  return item;
}

P.clearSessionCache();

// 1. 景點關門後排入 → reject
{
  const item = attach('札幌時計台', '札幌時計台');
  item.startTime = '19:00';
  item.endTime = '19:40';
  const v = P.validateItemAgainstPlaces(item, { weekday: 1, styleKey: 'sightseeing' });
  assert(!v.ok, '1 after-hours clock tower reject');
  assert(
    (v.issues || []).some((x) => x.type === 'outside_opening_hours'),
    '1b outside_opening_hours'
  );
}

// 2. 停留跨 closing → reject (arrive 17:40, close 18:00, stay 90)
{
  const item = attach('白色戀人公園', '白色戀人公園');
  item.startTime = '17:40';
  item.endTime = '19:10';
  const v = P.validateItemAgainstPlaces(item, { weekday: 3, styleKey: 'sightseeing' });
  assert(!v.ok, '2 stay past closing reject');
}

// 3. closed weekday → reject
{
  const item = attach('火曜休館美術館', '火曜休館美術館');
  item.startTime = '11:00';
  item.endTime = '12:30';
  // Tuesday = 2
  const v = P.validateItemAgainstPlaces(item, { weekday: 2, styleKey: 'sightseeing' });
  assert(!v.ok, '3 closed Tuesday reject');
  assert((v.issues || []).some((x) => x.type === 'closed_weekday'), '3b closed_weekday');
  const openMon = P.validateItemAgainstPlaces(item, { weekday: 1, styleKey: 'sightseeing' });
  assert(openMon.ok, '3c Monday open ok');
}

// 4. split restaurant hours — 15:30 dinner invalid
{
  const item = attach('分時段餐廳晚餐', '分時段餐廳');
  item.startTime = '15:30';
  item.endTime = '16:30';
  const v = P.validateItemAgainstPlaces(item, { weekday: 4, styleKey: 'foodie' });
  assert(!v.ok, '4 split hours midday gap reject');
  item.startTime = '18:00';
  item.endTime = '19:30';
  const v2 = P.validateItemAgainstPlaces(item, { weekday: 4, styleKey: 'foodie' });
  assert(v2.ok, '4b dinner window ok');
}

// 5. cross-midnight restaurant/bar — 00:30 still open
{
  const item = attach('跨午夜酒吧', '跨午夜酒吧');
  item.startTime = '00:30';
  item.endTime = '01:30';
  // Visit early Tuesday morning → spillover from Monday 18:00–02:00
  const v = P.validateItemAgainstPlaces(item, { weekday: 2, styleKey: 'nightlife' });
  assert(v.ok, '5 midnight bar open via spillover');
  const periods = item.__places.periods;
  const monWin = P.windowsForWeekday(periods, 1);
  assert(
    monWin.some((w) => w.endAbs > 24 * 60),
    '5b Mon window crosses midnight'
  );
}

// 6. unknown hours conservative scheduling
{
  const item = {
    title: '不知名小神社',
    startTime: '21:00',
    endTime: '22:00',
    openingHoursUnknown: true
  };
  const v = P.validateItemAgainstPlaces(item, { weekday: 1, styleKey: 'sightseeing' });
  assert(!v.ok, '6 unknown late attraction reject conservative');
  const repaired = P.repairItemIntoWindows(item, P.conservativeWindows('attraction'), {});
  assert(repaired.ok, '6b conservative repair');
  assert(P.hhmmToMinutes(repaired.item.startTime) < 17 * 60, '6c moved to daytime');
}

// 7. wrong-city Places match reject
{
  const tokyo = P.normalizePlaceRecord(P.SAPPORO_FIXTURES['東京時計台诱饵']);
  const score = P.scorePlaceMatch(tokyo, '札幌時計台', {
    city: '札幌',
    destination: '札幌',
    country: '日本',
    center: { lat: 43.06, lng: 141.35 },
    searchRadiusM: 25000
  });
  assert(!score.ok, '7 wrong-city clock tower match reject');
}

// 8. duplicate placeId reject
{
  const a = attach('札幌時計台', '札幌時計台');
  a.startTime = '10:00';
  a.endTime = '11:00';
  const b = attach('札幌時計台再次', '札幌時計台');
  b.startTime = '14:00';
  b.endTime = '15:00';
  const day = dayWith([a, b], 1);
  const gate = P.finalQaGateDay(day, { weekday: 1, styleKey: 'sightseeing' });
  assert(
    (gate.hard || []).some((x) => x.type === 'duplicate_placeId') || !gate.ok,
    '8 duplicate placeId hard fail'
  );
}

// 9. QA fail 不 render
{
  const closed = attach('火曜休館美術館', '火曜休館美術館');
  closed.startTime = '11:00';
  closed.endTime = '12:00';
  const hidden = { days: [dayWith([closed], 1)], meta: {} };
  const gated = await P.enrichAndGateHidden(hidden, {
    styleKey: 'sightseeing',
    weekday: 2,
    dateStart: '2026-08-11', // Tuesday
    resolvePlace: async () => P.fixtureResolver('火曜休館美術館'),
    replanDay: async () => null
  });
  assert(gated.renderOk === false, '9 QA fail does not render');
}

// 10. local repair success (after-hours → shifted)
{
  const item = attach('白色戀人公園', '白色戀人公園');
  item.startTime = '18:55';
  item.endTime = '20:55';
  const other = {
    title: '返回飯店休息',
    startTime: '21:30',
    endTime: '21:55'
  };
  const day = dayWith([item, other], 2);
  const repaired = P.localRepairDay(day, { weekday: 3, styleKey: 'sightseeing' });
  assert(repaired.ok, '10 local repair success');
  const shiroi = (repaired.day.phases || [])
    .flatMap((p) => p.items || [])
    .find((x) => /白色戀人/.test(x.title));
  assert(shiroi && P.hhmmToMinutes(shiroi.startTime) < 18 * 60, '10b shiroi before close');
}

// 11. only failed Day replan
{
  let replanCalls = [];
  const bad = attach('火曜休館美術館', '火曜休館美術館');
  bad.startTime = '11:00';
  bad.endTime = '12:00';
  const goodClock = attach('札幌時計台', '札幌時計台');
  goodClock.startTime = '10:00';
  goodClock.endTime = '11:00';
  const goodReturn = { title: '返回飯店休息', startTime: '20:00', endTime: '20:25' };
  const hidden = {
    days: [dayWith([goodClock, goodReturn], 1), dayWith([bad], 2)],
    meta: {}
  };
  // dateStart Monday 2026-08-10 → day2 = Tuesday
  await P.enrichAndGateHidden(hidden, {
    styleKey: 'sightseeing',
    dateStart: '2026-08-10',
    resolvePlace: async (q) => P.fixtureResolver(q),
    replanDay: async (dayNum) => {
      replanCalls.push(dayNum);
      // Provide a repairable replacement day
      const replacement = attach('札幌啤酒博物館', '札幌啤酒博物館');
      replacement.startTime = '13:00';
      replacement.endTime = '14:30';
      return dayWith(
        [replacement, { title: '返回飯店休息', startTime: '20:00', endTime: '20:25' }],
        dayNum
      );
    }
  });
  assert(replanCalls.length === 1 && replanCalls[0] === 2, '11 only failed day replanned');
}

// 12. midnight Time Integrity no regression
{
  const tl = T.normalizeItemTimeline({ startTime: '23:30', endTime: '00:30' });
  assert(tl.crossesMidnight && tl.endAbs === 1470, '12 midnight integrity intact');
  const day = dayWith(
    [
      { title: '深夜逛街', startTime: '23:30', endTime: '00:30' },
      { title: '便利商店採買', startTime: '20:00', endTime: '20:30' }
    ],
    1
  );
  const res = T.reconcileDayTimeline(day, {});
  const flat = res.day.phases.flatMap((p) => p.items || []);
  assert(T.assertChronological(flat), '12b chronological after integrity');
}

// Sapporo fixtures hard validation
{
  const beer = attach('札幌啤酒博物館', '札幌啤酒博物館');
  beer.startTime = '21:45';
  beer.endTime = '22:30';
  assert(
    !P.validateItemAgainstPlaces(beer, { weekday: 5, styleKey: 'sightseeing' }).ok,
    'fixture beer museum late reject'
  );
  const clock = attach('札幌時計台', '札幌時計台');
  clock.startTime = '19:00';
  clock.endTime = '19:40';
  assert(
    !P.validateItemAgainstPlaces(clock, { weekday: 5, styleKey: 'sightseeing' }).ok,
    'fixture clock tower late reject'
  );
}

// Cache reuse
{
  P.clearSessionCache();
  const key = P.cacheKey('札幌時計台', '', '2026-08-10');
  P.setCached(key, { place: P.fixtureResolver('札幌時計台'), matchInfo: { ok: true } });
  assert(!!P.getCached(key), 'cache set/get');
}

// Cost estimate
{
  const e3 = P.estimatePlacesRequests(3);
  const e5 = P.estimatePlacesRequests(5);
  const e7 = P.estimatePlacesRequests(7);
  assert(e3.estimatedSearchCalls <= 25 && e7.estimatedSearchCalls <= 25, 'cost capped at 25');
  assert(e5.estimatedUniquePois >= e3.estimatedUniquePois, 'cost scales with days');
  console.log(
    'Cost estimate:',
    JSON.stringify({ d3: e3, d5: e5, d7: e7 })
  );
}

console.log('\nPassed:', passed, 'Failed:', failed);
if (failed) process.exit(1);
