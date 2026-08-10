/**
 * Guide Intelligence P1 + Sapporo Golden + perf budget tests.
 * Usage: node scripts/test-itinerary-guide-intelligence.mjs
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
const T = g.SOARVIBE_ITINERARY_TIME_INTEGRITY;
const P = g.SOARVIBE_ITINERARY_PLACES_HOURS;
const G = g.SOARVIBE_GUIDE_INTELLIGENCE;

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

function day(items, dayNum) {
  return { dayNum, phases: [{ label: '晚上', items }] };
}

function attachHours(item, fixtureKey) {
  const place = P.normalizePlaceRecord(P.SAPPORO_FIXTURES[fixtureKey]);
  P.attachPlacesMeta(item, place, { ok: true, confidence: 0.9 }, 'fixture');
  return item;
}

assert(!!G.resolveDestinationPack('札幌'), 'pack resolves Sapporo');
assert(!!G.resolveDestinationPack('北海道'), 'pack resolves Hokkaido');
assert(G.STYLE_PROFILES.sightseeing.landmark > G.STYLE_PROFILES.foodie.landmark, 'style weights differ landmark');
assert(G.STYLE_PROFILES.foodie.food > G.STYLE_PROFILES.sightseeing.food, 'style weights differ food');

const season = G.deriveSeasonContext('2026-01-15');
assert(season.season === 'winter' && season.mobilityBuffer > 1, 'winter season buffer');
assert(G.deriveSeasonContext('2026-07-01').season === 'summer', 'summer season');

const brief = G.buildDestinationIntelligencePrompt('札幌', {
  dateStart: '2026-08-10',
  travelStyle: 'sightseeing'
});
assert(/大通|薄野|宮之澤/.test(brief), 'prompt brief has districts');
assert(/季節|星期|season/.test(brief), 'prompt brief has season');
assert(/famousRatio|landmark=/.test(brief), 'prompt brief has style weights');

const badHidden = {
  days: [
    day(
      [
        { title: '札幌車站周邊自由逛街', startTime: '23:30', endTime: '00:30' },
        { title: '便利商店採買', startTime: '20:00', endTime: '20:30' },
        { title: '返回飯店休息', startTime: '00:40', endTime: '01:00' }
      ],
      1
    ),
    day(
      [
        attachHours(
          { title: '札幌啤酒博物館', startTime: '21:45', endTime: '22:30' },
          '札幌啤酒博物館'
        ),
        { title: '札幌啤酒園晚餐', startTime: '22:45', endTime: '00:45' },
        { title: '返回市中心', startTime: '19:40', endTime: '20:10' },
        { title: '藥妝店', startTime: '20:30', endTime: '21:20' },
        { title: '返回飯店休息', startTime: '01:00', endTime: '01:20' }
      ],
      2
    ),
    day(
      [
        attachHours(
          { title: '白色戀人公園', startTime: '18:55', endTime: '20:55' },
          '白色戀人公園'
        ),
        { title: '狸小路', startTime: '19:55', endTime: '21:55' },
        { title: '晚餐', startTime: '22:45', endTime: '00:15' },
        { title: '藥妝／唐吉訶德／便利商店', startTime: '19:30', endTime: '20:30' },
        { title: '返回飯店休息', startTime: '00:30', endTime: '00:50' }
      ],
      3
    ),
    day(
      [
        attachHours(
          { title: '札幌時計台', startTime: '19:00', endTime: '19:40' },
          '札幌時計台'
        ),
        { title: '下午茶·甜點', startTime: '20:00', endTime: '21:00' },
        { title: '晚餐', startTime: '22:35', endTime: '00:05' },
        { title: '唐吉訶德', startTime: '18:45', endTime: '19:30' },
        { title: '返回住宿', startTime: '19:50', endTime: '20:20' }
      ],
      4
    )
  ],
  meta: {}
};

T.reconcileHiddenItinerary(badHidden, { styleKey: 'sightseeing' });
badHidden.days.forEach((d) => {
  P.localRepairDay(d, { weekday: 3, styleKey: 'sightseeing' });
});

const guided = G.optimizeHidden(JSON.parse(JSON.stringify(badHidden)), {
  destination: '札幌',
  styleKey: 'sightseeing',
  dateStart: '2026-08-10',
  hotelArea: '札幌站',
  mode: 'public-transit'
});

function flatTitles(hidden) {
  return (hidden.days || []).flatMap((d) =>
    (d.phases || []).flatMap((p) => (p.items || []).map((i) => i.title))
  );
}

function flatItems(dayObj) {
  return (dayObj.phases || []).flatMap((p) => p.items || []);
}

{
  const all = guided.hidden.days.flatMap((d) => flatItems(d));
  guided.hidden.days.forEach((d, i) => {
    assert(T.assertChronological(flatItems(d)), `golden day${i + 1} chronological`);
  });

  const clock = all.find((x) => /時計台/.test(x.title));
  if (clock) {
    assert(T.hhmmToMinutes(clock.startTime) < 17 * 60, 'golden clock tower not evening');
  } else {
    assert(true, 'golden clock tower shifted/dropped ok');
  }
  const shiroi = all.find((x) => /白色戀人/.test(x.title));
  if (shiroi) {
    assert(T.hhmmToMinutes(shiroi.startTime) < 18 * 60, 'golden shiroi before close');
  } else {
    assert(true, 'golden shiroi shifted/dropped ok');
  }
  const beer = all.find((x) => /啤酒博物館/.test(x.title));
  if (beer) {
    assert(T.hhmmToMinutes(beer.startTime) < 18 * 60, 'golden beer museum not late');
  } else {
    assert(true, 'golden beer museum shifted/dropped ok');
  }

  guided.hidden.days.forEach((d, i) => {
    const items = flatItems(d);
    for (let j = 1; j < items.length; j++) {
      const a = T.normalizeItemTimeline(items[j - 1]);
      const b = T.normalizeItemTimeline(items[j]);
      if (!isNaN(a.startAbs) && !isNaN(b.startAbs)) {
        assert(b.startAbs >= a.startAbs, `golden no regression day${i + 1} #${j}`);
      }
    }
  });

  const titles = flatTitles(guided.hidden).join('|');
  const convCount = (titles.match(/便利商店|唐吉訶德|藥妝/g) || []).length;
  assert(convCount <= 2, 'golden not daily convenience spam: ' + convCount);

  const returnCount = (titles.match(/返回飯店|返回住宿/g) || []).length;
  assert(returnCount <= guided.hidden.days.length, 'golden return cards <= days');

  guided.hidden.days.forEach((d) => {
    const route = d.__guideDay && d.__guideDay.routeDetail;
    if (route && route.uniqueDistricts != null) {
      assert(route.uniqueDistricts <= 4, 'golden district thrash limited');
    }
  });

  assert(typeof guided.guideScore === 'number', 'guideScore numeric');
  assert(guided.threshold === G.GUIDE_SCORE_THRESHOLD, 'threshold exposed');
  console.log('Guide score after optimize:', guided.guideScore, 'weakDays:', guided.weakDays);
}

{
  const good = {
    days: [
      day(
        [
          attachHours(
            { title: '札幌時計台', startTime: '10:00', endTime: '10:40' },
            '札幌時計台'
          ),
          { title: '札幌電視塔', startTime: '11:00', endTime: '11:50' },
          { title: '午餐·湯咖哩', startTime: '12:10', endTime: '13:10' },
          { title: '狸小路', startTime: '13:40', endTime: '15:30' },
          { title: '晚餐·薄野拉麵', startTime: '18:30', endTime: '19:30' },
          { title: '返回飯店休息', startTime: '20:00', endTime: '20:25' }
        ],
        1
      )
    ],
    meta: {}
  };
  const res = G.optimizeHidden(good, {
    destination: '札幌',
    styleKey: 'sightseeing',
    dateStart: '2026-08-10',
    hotelArea: '大通'
  });
  assert(res.guideScore >= G.GUIDE_SCORE_THRESHOLD, 'good cluster meets threshold: ' + res.guideScore);
  assert(/經典|城市核心|美食|夜生活|探索|散策/.test(res.hidden.days[0].__guideDay.dayTheme), 'dayTheme assigned: ' + res.hidden.days[0].__guideDay.dayTheme);
}

{
  const zigzagItems = [
    { title: '札幌時計台', startTime: '10:00', endTime: '10:40' },
    { title: '白色戀人公園', startTime: '11:30', endTime: '13:00' },
    { title: '狸小路', startTime: '14:00', endTime: '15:30' },
    { title: '札幌啤酒博物館', startTime: '16:30', endTime: '17:30' },
    { title: '返回飯店休息', startTime: '20:00', endTime: '20:25' }
  ];
  zigzagItems.forEach((it) => {
    if (/時計台/.test(it.title)) attachHours(it, '札幌時計台');
    if (/白色戀人/.test(it.title)) attachHours(it, '白色戀人公園');
    if (/啤酒博物館/.test(it.title)) attachHours(it, '札幌啤酒博物館');
  });
  const zigDay = day(zigzagItems, 1);
  zigzagItems.forEach((it) => G.annotateItem(it, G.resolveDestinationPack('札幌')));
  const before = G.scoreRouteEfficiency(zigzagItems, G.resolveDestinationPack('札幌'), {});
  const opt = G.optimizeDay(JSON.parse(JSON.stringify(zigDay)), {
    pack: G.resolveDestinationPack('札幌'),
    styleKey: 'sightseeing',
    hotelArea: '札幌站'
  });
  assert(opt.score >= 0, 'zigzag optimize runs');
  assert(before.score < 90, 'zigzag starts inefficient: ' + before.score);
  console.log('Zigzag route before', before.score, 'after day score', opt.score);
}

{
  const arrival = G.inferDayRole(1, 4);
  const mid = G.inferDayRole(2, 4);
  const dep = G.inferDayRole(4, 4);
  assert(arrival === 'arrival' && mid === 'full' && dep === 'departure', 'day roles');
  const heavyArrival = day(
    [
      { title: 'A', startTime: '16:00', endTime: '17:00' },
      { title: 'B', startTime: '17:30', endTime: '18:30' },
      { title: 'C', startTime: '19:00', endTime: '20:00' },
      { title: 'D', startTime: '20:30', endTime: '21:30' },
      { title: '返回飯店休息', startTime: '22:00', endTime: '22:20' }
    ],
    1
  );
  heavyArrival.phases[0].items.forEach((it) =>
    G.annotateItem(it, G.resolveDestinationPack('札幌'))
  );
  const pace = G.computeDayGuideScore(heavyArrival, {
    pack: G.resolveDestinationPack('札幌'),
    styleKey: 'sightseeing',
    dayRole: 'arrival'
  });
  assert(pace.parts.pace < 85, 'arrival heavy pace penalized');
}

{
  const shopDays = [
    [{ title: '大通百貨', startTime: '14:00', endTime: '16:00' }],
    [{ title: '札幌站商場', startTime: '14:00', endTime: '16:00' }],
    [{ title: '另一購物中心', startTime: '14:00', endTime: '16:00' }]
  ].map((items) => {
    items.forEach((it) => G.annotateItem(it, G.resolveDestinationPack('札幌')));
    return items;
  });
  const div = G.scoreDiversity(shopDays, 'sightseeing');
  assert(div.score < 70, 'shopping spam diversity low: ' + div.score);
}

{
  const items = [
    { title: '札幌時計台', startTime: '10:00', endTime: '10:40' },
    { title: '白色戀人公園旁晚餐', startTime: '18:30', endTime: '19:30' }
  ];
  attachHours(items[0], '札幌時計台');
  attachHours(items[1], '白色戀人公園');
  items.forEach((it) => G.annotateItem(it, G.resolveDestinationPack('札幌')));
  items[1].__guide.experience = 'food';
  const meal = G.scoreMealPlacement(items, G.resolveDestinationPack('札幌'));
  assert(meal.score < 90, 'far meal penalized');
}

function synthDays(n) {
  const days = [];
  for (let i = 1; i <= n; i++) {
    days.push(
      day(
        [
          attachHours(
            { title: '札幌時計台', startTime: '10:00', endTime: '10:40' },
            '札幌時計台'
          ),
          { title: '狸小路', startTime: '11:00', endTime: '12:30' },
          { title: '午餐', startTime: '12:45', endTime: '13:45' },
          { title: '大通公園', startTime: '14:15', endTime: '15:15' },
          { title: '晚餐·薄野', startTime: '18:30', endTime: '19:40' },
          { title: '便利商店採買', startTime: '20:00', endTime: '20:20' },
          { title: '返回飯店休息', startTime: '20:40', endTime: '21:00' }
        ],
        i
      )
    );
  }
  return { days, meta: {} };
}

function profileDays(n) {
  const hidden = synthDays(n);
  const clock = G.createPerfClock();
  clock.start('timeIntegrity');
  T.reconcileHiddenItinerary(hidden, { styleKey: 'sightseeing' });
  const tiMs = clock.end('timeIntegrity');
  clock.start('placesQa');
  hidden.days.forEach((d) => P.localRepairDay(d, { weekday: 1, styleKey: 'sightseeing' }));
  const placesMs = clock.end('placesQa');
  clock.start('guideOptimize');
  const out = G.optimizeHidden(hidden, {
    destination: '札幌',
    styleKey: 'sightseeing',
    dateStart: '2026-08-10'
  });
  const guideMs = clock.end('guideOptimize');
  return {
    days: n,
    timeIntegrityMs: tiMs,
    placesQaMs: placesMs,
    guideOptimizeMs: guideMs,
    totalCpuMs: tiMs + placesMs + guideMs,
    placesEstimate: P.estimatePlacesRequests(n),
    guideScore: out.guideScore
  };
}

const perf3 = profileDays(3);
const perf5 = profileDays(5);
const perf7 = profileDays(7);
console.log('\nPerf (CPU fixture, no live Gemini/Places network):');
console.log(JSON.stringify({ perf3, perf5, perf7 }, null, 2));
assert(perf5.totalCpuMs < 2000, '5-day CPU path << 2s (not 30–60s)');
assert(perf7.placesEstimate.estimatedSearchCalls <= 25, '7-day places cap 25');
assert(perf3.placesEstimate.estimatedSearchCalls <= 15, '3-day places modest');

console.log(
  '\nLive latency note: Gemini + Places network not invoked in this suite; ' +
    'budget target total generation < 20s for 5-day with Places concurrency.'
);

console.log('\nPassed:', passed, 'Failed:', failed);
if (failed) process.exit(1);
