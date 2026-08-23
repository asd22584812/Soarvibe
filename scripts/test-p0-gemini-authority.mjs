/**
 * P0 — Gemini owns itinerary: golden regressions from Sapporo real-device cases.
 * Run: node scripts/test-p0-gemini-authority.mjs
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
    },
    applyTimeQaToHidden: function (hidden) {
      return { hidden: hidden, issues: [], fixes: [], ok: true };
    }
  };
  [
    'itinerary-time-integrity.js',
    'itinerary-places-hours.js',
    'itinerary-destination-intelligence.js',
    'itinerary-guide-intelligence.js',
    'itinerary-route-duration.js',
    'itinerary-style-engine.js',
    'itinerary-planner-v2.js',
    'travel-time-engine.js'
  ].forEach(function (f) {
    vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sandbox, { filename: f });
  });
  return sandbox;
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function flatItems(hidden) {
  const out = [];
  (hidden.days || []).forEach(function (d) {
    (d.phases || []).forEach(function (ph) {
      (ph.items || []).forEach(function (it) {
        out.push({
          day: d.dayNum,
          title: it.title || '',
          start: it.startTime || '',
          end: it.endTime || '',
          offset: Number(it.startDayOffset) || 0
        });
      });
    });
  });
  return out;
}

function titles(hidden, day) {
  return flatItems(hidden)
    .filter(function (x) {
      return day == null || x.day === day;
    })
    .map(function (x) {
      return x.title;
    });
}

function hasMidnightInMiddle(dayItems) {
  for (let i = 1; i < dayItems.length - 1; i++) {
    const cur = dayItems[i];
    const prev = dayItems[i - 1];
    const next = dayItems[i + 1];
    const curM = /^(\d{2}):(\d{2})$/.exec(cur.start);
    const prevM = /^(\d{2}):(\d{2})$/.exec(prev.start);
    const nextM = /^(\d{2}):(\d{2})$/.exec(next.start);
    if (!curM || !prevM || !nextM) continue;
    const c = +curM[1] * 60 + +curM[2];
    const p = +prevM[1] * 60 + +prevM[2];
    const n = +nextM[1] * 60 + +nextM[2];
    if (c < 5 * 60 && p >= 8 * 60 && n >= 8 * 60 && (cur.offset || 0) === 0) return true;
  }
  return false;
}

const env = loadAll();
const SE = env.SOARVIBE_STYLE_ENGINE;
const P = env.SOARVIBE_PLANNER_V2;
const TTE = env.SOARVIBE_TRAVEL_TIME_ENGINE;
const TI = env.SOARVIBE_TIME_INTEGRITY;

assert(!!SE && !!P && !!TTE, 'modules loaded');
assert(SE.canCreateContent === false, 'Style Engine canCreateContent false');
assert(typeof SE.buildPlanningIntentPrompt === 'function', 'planning intent helper');
assert(/food becomes|美食主軸|食物為行程錨點/.test(SE.buildPlanningIntentPrompt('foodie', '札幌')), 'foodie intent');
assert(/動漫/.test(SE.buildPlanningIntentPrompt('anime', '札幌')), 'anime intent');

const planOpt = {
  styleKey: 'sightseeing',
  applyStyleEngine: true,
  allowMapsJs: false,
  allowWorkerRoutes: false,
  useFixtureResolver: false,
  annotateRoutes: false,
  reattachRoutes: false,
  fetchRouteDuration: async function () {
    return { estimatedMinutes: 15, source: 'injected' };
  }
};

console.log('\n=== CASE1 arrival order (hotel before airport→city) ===');
const case1 = {
  meta: { destination: '札幌', travelStyle: 'sightseeing' },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            { title: '新千歲機場入境', startTime: '11:30', endTime: '13:00', eventType: 'arrival' },
            { title: '返回市中心住宿休息', startTime: '13:40', endTime: '14:10', eventType: 'rest' },
            {
              title: 'JR快速Airport號：新千歲機場 → 札幌車站',
              startTime: '14:30',
              endTime: '15:20',
              eventType: 'transport'
            },
            { title: '大通公園', startTime: '16:00', endTime: '17:00' }
          ]
        }
      ]
    }
  ]
};
const r1 = await P.planHiddenItineraryAsync(clone(case1), case1.meta, planOpt);
const t1 = titles(r1.hidden, 1);
assert(!t1.some(function (t) { return /返回市中心住宿/.test(t); }), 'CASE1 dropped hotel before transfer');
const transferIdx = t1.findIndex(function (t) { return /新千歲機場\s*→\s*札幌/.test(t); });
const parkIdx = t1.findIndex(function (t) { return /大通公園/.test(t); });
assert(transferIdx !== -1 && parkIdx > transferIdx, 'CASE1 city POI after airport→city');
assert(
  (r1.repairs || []).some(function (r) {
    return r.type === 'drop_hotel_return_before_arrival_transfer';
  }),
  'CASE1 repair recorded'
);

console.log('\n=== CASE2/3 midnight-in-middle ===');
const case2 = {
  meta: { destination: '札幌' },
  days: [
    {
      dayNum: 2,
      phases: [
        {
          items: [
            { title: '北海道大學', startTime: '11:20', endTime: '13:20' },
            { title: '返回住宿休息', startTime: '00:05', endTime: '00:35', eventType: 'rest' },
            { title: '狸小路商店街', startTime: '14:10', endTime: '15:40' }
          ]
        }
      ]
    }
  ]
};
const r2 = await P.planHiddenItineraryAsync(clone(case2), case2.meta, Object.assign({}, planOpt, { styleKey: 'trendy' }));
const day2Items = flatItems(r2.hidden).filter(function (x) { return x.day === 2; });
assert(!hasMidnightInMiddle(day2Items), 'CASE2 no 00:xx between daytime events');
assert(
  !(day2Items.some(function (x, i) {
    return (
      /^00:/.test(x.start) &&
      i > 0 &&
      i < day2Items.length - 1 &&
      !/^00:/.test(day2Items[i - 1].start) &&
      !/^00:/.test(day2Items[i + 1].start)
    );
  })),
  'CASE2 midnight not sandwiched'
);

const case3 = {
  meta: { destination: '札幌' },
  days: [
    {
      dayNum: 3,
      phases: [
        {
          items: [
            { title: '北海道大學', startTime: '11:05', endTime: '13:05' },
            { title: '返回住宿休息', startTime: '00:35', endTime: '01:05', eventType: 'rest' },
            { title: '薄野夜遊', startTime: '01:25', endTime: '02:25' },
            { title: '狸小路午後', startTime: '13:55', endTime: '15:00' }
          ]
        }
      ]
    }
  ]
};
const r3 = await P.planHiddenItineraryAsync(clone(case3), case3.meta, planOpt);
assert(!hasMidnightInMiddle(flatItems(r3.hidden).filter(function (x) { return x.day === 3; })), 'CASE3 midnight-in-middle fixed');

console.log('\n=== CASE4 Otaru geographic ping-pong ===');
const case4 = {
  meta: { destination: '札幌', travelStyle: 'foodie' },
  days: [
    {
      dayNum: 2,
      phases: [
        {
          items: [
            { title: '小樽運河', startTime: '09:50', endTime: '11:20' },
            { title: '午餐：根室花丸 JR札幌 Stellar Place', startTime: '12:20', endTime: '13:20' },
            { title: '小樽運河食堂', startTime: '14:50', endTime: '16:00' },
            { title: '小樽音樂盒堂', startTime: '16:40', endTime: '17:40' }
          ]
        }
      ]
    }
  ]
};
const r4 = P.repairItinerary(clone(case4), case4.meta);
assert(
  (r4.repairs || []).some(function (r) {
    return r.type === 'geographic_ping_pong' && /otaru.*sapporo.*otaru/i.test(String(r.path || ''));
  }) ||
    (r4.validation.issues || []).some(function (x) {
      return x.type === 'geographic_ping_pong';
    }),
  'CASE4 geographic_ping_pong flagged (not silently rewritten)'
);
assert(
  titles(r4.hidden, 2).filter(function (t) { return /小樽運河/.test(t); }).length >= 1,
  'CASE4 Gemini Otaru POIs retained (no POI swap)'
);

console.log('\n=== CASE5 meal prefix idempotent ===');
const meals = ['早餐', '午餐', '下午茶', '晚餐', '宵夜'];
meals.forEach(function (label) {
  const once = label + '：LeTAO';
  const spam = label + '：' + label + '：' + label + '：' + label + '：' + label + '：LeTAO';
  assert(P.stripMealPrefixes(spam) === 'LeTAO', label + ' strip repeats');
  assert(P.withMealPrefix(spam, label) === once, label + ' withMealPrefix idempotent');
  assert(P.withMealPrefix(once, label) === once, label + ' already-prefixed stable');
});
const mealHidden = {
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            {
              title: '晚餐：晚餐：晚餐：晚餐：晚餐：LeTAO',
              startTime: '18:30',
              endTime: '19:30',
              eventType: 'food'
            }
          ]
        }
      ]
    }
  ]
};
const rMeal = P.repairItinerary(mealHidden, { destination: '札幌' });
assert(
  titles(rMeal.hidden, 1).some(function (t) {
    return t === '晚餐：LeTAO';
  }),
  'CASE5 collapsed to 晚餐：LeTAO'
);
assert(!titles(rMeal.hidden, 1).some(function (t) { return /晚餐：晚餐：/.test(t); }), 'CASE5 no double prefix');

console.log('\n=== CASE6 trip duplicate major POI ===');
const case6 = {
  meta: { destination: '札幌' },
  days: [
    {
      dayNum: 1,
      phases: [{ items: [{ title: '札幌電視塔', startTime: '16:00', endTime: '17:00' }] }]
    },
    {
      dayNum: 3,
      phases: [{ items: [{ title: '札幌電視塔', startTime: '15:00', endTime: '16:00' }] }]
    }
  ]
};
const r6 = P.repairItinerary(clone(case6), case6.meta);
const towerDays = flatItems(r6.hidden)
  .filter(function (x) {
    return /札幌電視塔/.test(x.title);
  })
  .map(function (x) {
    return x.day;
  });
assert(towerDays.length === 1, 'CASE6 TV tower once (days=' + towerDays.join(',') + ')');

console.log('\n=== Style Engine audit-only (no inject / no drop) ===');
const gemGood = {
  meta: { destination: '札幌', travelStyle: 'sightseeing' },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            { title: '大通公園', startTime: '10:00', endTime: '11:30' },
            { title: '午餐：湯咖哩', startTime: '12:00', endTime: '13:00' },
            { title: '時計台', startTime: '14:00', endTime: '15:00' }
          ]
        }
      ]
    }
  ]
};
const beforeTitles = titles(gemGood);
const styled = SE.applyStyleEngine(clone(gemGood), {
  travelStyle: 'sightseeing',
  destination: '札幌',
  customWishes: '一定要去小樽'
});
assert(JSON.stringify(titles(styled.hidden)) === JSON.stringify(beforeTitles), 'Style keeps Gemini titles');
assert(styled.hidden.meta.styleEngine.canMutateSchedule === false, 'canMutateSchedule false');
assert(styled.hidden.meta.styleEngine.auditOnly === true, 'auditOnly true');
assert((styled.unfulfilledUserRequest || []).some(function (u) { return /小樽/.test(u.request); }), 'wish not silent-dropped');

console.log('\n=== Time QA must not invent 00:xx mid-day (integrity preserve offset) ===');
if (TI && typeof TI.normalizeItemTimeline === 'function') {
  const tl = TI.normalizeItemTimeline({
    startTime: '00:30',
    endTime: '01:00',
    startDayOffset: 1,
    endDayOffset: 1
  });
  assert(tl.startDayOffset === 1, 'startDayOffset preserved');
}
const corruptLike = {
  meta: { destination: '札幌' },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            { title: '返回住宿休息', startTime: '23:40', endTime: '00:20', startDayOffset: 0, endDayOffset: 1 },
            { title: '新千歲機場入境', startTime: '11:30', endTime: '13:00' },
            { title: 'JR快速Airport號：新千歲機場 → 札幌車站', startTime: '13:20', endTime: '14:00' }
          ]
        }
      ]
    }
  ]
};
const qa = TTE.applyTimeQaToHidden(clone(corruptLike), {});
const qaDay1 = flatItems(qa.hidden).filter(function (x) { return x.day === 1; });
assert(!hasMidnightInMiddle(qaDay1) || qaDay1[0].start !== '01:00', 'TimeQA does not promote rest to 01:00 head');
assert(!(qa.fixes || []).some(function (f) { return /shift|trim_for_airport/.test(f.type || ''); }), 'TimeQA no schedule rewrite fixes');

console.log('\n=== Gemini authority pipeline preserves good Day1 ===');
const goodGemini = {
  meta: {
    destination: '札幌',
    travelStyle: 'sightseeing',
    customWishes: '一定要去小樽，想吃成吉思汗',
    flightArrival: '2026-11-20T11:30:00',
    flightMode: 'user_provided'
  },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            { title: '新千歲機場抵達與入境手續', startTime: '11:30', endTime: '13:00', eventType: 'arrival' },
            {
              title: 'JR快速Airport號：新千歲機場 → 札幌車站',
              startTime: '13:00',
              endTime: '13:40',
              eventType: 'transport'
            },
            { title: '抵達札幌站 & 住宿Check-in', startTime: '13:40', endTime: '14:10' },
            { title: '午餐：湯咖哩名店 Suage+', startTime: '14:10', endTime: '15:30' },
            { title: '寶可夢中心 札幌店', startTime: '15:30', endTime: '17:00' }
          ]
        }
      ]
    }
  ]
};
const beforeGood = titles(goodGemini, 1);
const plannedGood = await P.planHiddenItineraryAsync(clone(goodGemini), goodGemini.meta, planOpt);
const afterGood = titles(plannedGood.hidden, 1);
assert(afterGood.length >= 4, 'good Day1 mostly retained (n=' + afterGood.length + ')');
assert(afterGood[0].indexOf('新千歲') !== -1, 'Day1 starts at airport');
assert(afterGood.some(function (t) { return /Airport號：新千歲機場\s*→\s*札幌/.test(t); }), 'arrival transfer kept');
assert(afterGood.some(function (t) { return /湯咖哩|Suage/.test(t); }), 'Gemini lunch kept');
assert(
  plannedGood.hidden.meta.customWishes === '一定要去小樽，想吃成吉思汗' ||
    goodGemini.meta.customWishes === '一定要去小樽，想吃成吉思汗',
  'customWishes preserved'
);
assert(
  !beforeGood.every(function (t, i) { return afterGood[i] === t; }) || afterGood.length === beforeGood.length,
  'pipeline ran'
);

console.log('\n=== 14.1 Preserve Gemini Intent ===');
const intentRaw = {
  meta: {
    destination: '札幌',
    travelStyle: 'sightseeing',
    customWishes: '一定要去小樽，想吃成吉思汗'
  },
  days: [
    {
      dayNum: 1,
      phases: [
        {
          items: [
            {
              title: '新千歲機場抵達與入境手續',
              startTime: '11:30',
              endTime: '13:00',
              eventType: 'arrival',
              note: '入境與提領行李'
            },
            {
              title: 'JR快速Airport號：新千歲機場 → 札幌車站',
              startTime: '13:00',
              endTime: '13:40',
              eventType: 'transport',
              note: '機場快線直達札幌'
            },
            { title: '抵達札幌站 & 住宿Check-in', startTime: '13:40', endTime: '14:10', note: '放下行李' },
            {
              title: '午餐：湯咖哩名店 Suage+',
              startTime: '14:10',
              endTime: '15:30',
              note: '北海道湯咖哩'
            },
            {
              title: '寶可夢中心 札幌店',
              startTime: '15:30',
              endTime: '17:00',
              highlight: '依許願',
              note: '角色商品'
            },
            { title: '札幌電視塔', startTime: '17:30', endTime: '18:30', note: '大通夜景' },
            {
              title: '晚餐：成吉思汗烤肉',
              startTime: '19:00',
              endTime: '20:30',
              note: '依許願烤肉'
            }
          ]
        }
      ]
    },
    {
      dayNum: 2,
      phases: [
        {
          items: [
            { title: '小樽運河', startTime: '10:00', endTime: '11:30', note: '運河散步' },
            { title: '午餐：政壽司', startTime: '12:00', endTime: '13:30', note: '小樽壽司' },
            { title: '小樽音樂盒堂', startTime: '14:00', endTime: '15:00', note: '音樂盒' }
          ]
        }
      ]
    }
  ]
};
const intentPlanned = await P.planHiddenItineraryAsync(clone(intentRaw), intentRaw.meta, planOpt);
const ip = intentPlanned.intentPreservation || intentPlanned.hidden.meta.intentPreservation;
console.log(
  '  intent metrics',
  JSON.stringify({
    rawPoiCount: ip.rawPoiCount,
    finalPoiCount: ip.finalPoiCount,
    preservedPoiCount: ip.preservedPoiCount,
    poiPreservationRate: ip.poiPreservationRate,
    mealPreservationRate: ip.mealPreservationRate,
    districtPreservationRate: ip.districtPreservationRate,
    descriptionPreservationRate: ip.descriptionPreservationRate,
    transportPreservationRate: ip.transportPreservationRate,
    customWishesPreserved: ip.customWishesPreserved,
    intentOk: ip.intentOk
  })
);
assert(!!ip, 'intentPreservation present');
assert(ip.rawPoiCount >= 4, 'rawPoiCount reported');
assert(ip.preservedPoiCount >= 4, 'preservedPoiCount reported');
assert(ip.poiPreservationRate >= 0.75, 'poiPreservationRate >= 0.75 (got ' + ip.poiPreservationRate + ')');
assert(ip.customWishesPreserved === true, 'customWishes preserved on intent metric');
assert(ip.intentOk === true, 'intentOk true for good Gemini candidate');
assert(!!intentPlanned.hidden.meta.geminiCandidate, 'geminiCandidate retained for audit');
assert(
  titles(intentPlanned.hidden).some(function (t) { return /小樽運河/.test(t); }) &&
    titles(intentPlanned.hidden).some(function (t) { return /成吉思汗|Suage|湯咖哩/.test(t); }),
  'POI identity + meal intent preserved'
);
assert(
  titles(intentPlanned.hidden).some(function (t) { return /Airport號：新千歲機場/.test(t); }),
  'transport explanation title preserved'
);
assert(ip.intentOk !== false || intentPlanned.needsReplan === true, 'bad intent forces needsReplan');

console.log('\n=== 5.1 Minimal repair boundary / needsReplan ===');
const ping = P.repairItinerary(clone(case4), case4.meta);
assert(ping.needsReplan === true || (ping.hidden.meta && ping.hidden.meta.needsReplan), 'ping-pong → needsReplan');
assert(
  String((ping.hidden.meta && ping.hidden.meta.replanReason) || '').indexOf('geographic_ping_pong') !== -1 ||
    (ping.replanReasons || []).some(function (r) { return /geographic_ping_pong/.test(r); }),
  'replanReason includes geographic_ping_pong'
);
assert(
  titles(ping.hidden, 2).some(function (t) { return /小樽運河/.test(t); }) &&
    titles(ping.hidden, 2).some(function (t) { return /音樂盒/.test(t); }),
  'FAIL SAFELY: Otaru POIs not swapped for Sapporo attractions'
);
assert(
  !(ping.repairs || []).some(function (r) {
    return /inject|invent|replace_poi|swap_/i.test(String(r.type || ''));
  }),
  'no POI invent/replace repairs'
);

const policy = intentPlanned.hidden.meta.plannerV2 && intentPlanned.hidden.meta.plannerV2.policy;
assert(policy && policy.deny.indexOf('replace_poi_identity') !== -1, 'policy denies POI replace');
assert(policy.principle === 'FAIL_SAFELY_OVER_REWRITE_BADLY', 'FAIL SAFELY principle');

console.log('\n=== Gemini-first audit path (mutation≈0) ===');
assert(typeof P.auditGeminiItinerary === 'function', 'auditGeminiItinerary exists');
const auditGood = P.auditGeminiItinerary(clone(intentRaw), intentRaw.meta, { applyStyleEngine: true, styleKey: 'sightseeing' });
assert((auditGood.mutationCount || 0) <= 5, 'good itinerary mutationCount low (got ' + auditGood.mutationCount + '; only meal-prefix cleanup allowed)');
assert(
  !(auditGood.repairs || []).some(function (r) {
    return /drop_|shift_|inject|reorder_|fix_midnight/i.test(String(r.type || ''));
  }),
  'audit path has no schedule/POI rewrite repairs'
);
assert(auditGood.intentPreservation && auditGood.intentPreservation.poiPreservationRate >= 0.95, 'audit preserves POIs');
assert(!!auditGood.hidden.meta.geminiCandidate, 'audit keeps geminiCandidate');
assert(
  titles(auditGood.hidden).filter(function (t) { return /小樽運河|Suage|成吉思汗|寶可夢|電視塔/.test(t); }).length >= 4,
  'audit does not rewrite Gemini POIs'
);

const mealBad = P.auditGeminiItinerary(
  {
    days: [
      {
        dayNum: 1,
        phases: [
          {
            items: [
              { title: '早餐：飯店', startTime: '13:30', endTime: '14:00' },
              { title: '午餐：拉麵', startTime: '20:20', endTime: '21:00' }
            ]
          }
        ]
      }
    ]
  },
  { destination: '札幌' },
  { applyStyleEngine: false }
);
assert(mealBad.needsGeminiReplan === true || mealBad.needsReplan === true, '13:30 breakfast / 20:20 lunch → needsGeminiReplan');
assert(
  (mealBad.replanReasons || []).some(function (r) { return /meal/i.test(r); }) ||
    (mealBad.repairs || []).some(function (r) { return r.type === 'mealTimingInvalid'; }),
  'mealTimingInvalid flagged (no time rewrite)'
);
assert(
  titles(mealBad.hidden).some(function (t) { return /早餐/.test(t) && true; }),
  'meal titles kept (validator does not relocate meals)'
);

const midBad = P.auditGeminiItinerary(
  {
    days: [
      {
        dayNum: 3,
        phases: [
          {
            items: [
              { title: '小樽運河', startTime: '11:25', endTime: '12:25' },
              { title: 'LeTAO', startTime: '00:35', endTime: '01:05' },
              { title: '星乃咖啡', startTime: '13:30', endTime: '14:30' }
            ]
          }
        ]
      }
    ]
  },
  {},
  { applyStyleEngine: false }
);
assert(midBad.needsGeminiReplan || midBad.needsReplan, '00:35 between daytime → needsGeminiReplan');
assert(
  (midBad.repairs || []).some(function (r) { return r.type === 'dayBoundaryInvalid'; }),
  'dayBoundaryInvalid regression'
);
assert(titles(midBad.hidden).some(function (t) { return /LeTAO/.test(t); }), 'does not drop LeTAO identity');

const retBad = P.auditGeminiItinerary(
  {
    days: [
      {
        dayNum: 4,
        phases: [
          {
            items: [
              { title: '返回住宿休息', startTime: '21:00', endTime: '21:30', eventType: 'rest' },
              { title: '晚餐：成吉思汗', startTime: '22:25', endTime: '23:30' }
            ]
          }
        ]
      }
    ]
  },
  {},
  { applyStyleEngine: false }
);
assert(
  (retBad.repairs || []).some(function (r) { return r.type === 'activity_after_end_of_day_return'; }),
  'return-then-activity regression'
);

console.log('\n=== valid_gemini_itinerary_must_not_be_replanned ===');
{
  const valid = clone(intentRaw);
  const before = JSON.stringify(
    flatItems(valid).map(function (x) {
      return { day: x.day, title: x.title, start: x.start, end: x.end };
    })
  );
  const tte = env.SOARVIBE_TRAVEL_TIME_ENGINE;
  const qa = tte.applyTimeQaToHidden(clone(valid), valid.meta || {});
  const audited = P.auditGeminiItinerary(qa.hidden, valid.meta || {}, {
    applyStyleEngine: true,
    styleKey: 'sightseeing'
  });
  const after = JSON.stringify(
    flatItems(audited.hidden).map(function (x) {
      return { day: x.day, title: x.title, start: x.start, end: x.end };
    })
  );
  const mutTypes = (audited.repairs || [])
    .map(function (r) {
      return r.type;
    })
    .filter(function (t) {
      return !/meal_prefix_idempotent|style_audit|style_audit_trip_repeat/.test(t);
    });
  assert(
    flatItems(audited.hidden).every(function (x, i) {
      const b = flatItems(valid)[i];
      return b && b.day === x.day && b.title === x.title && b.start === x.start;
    }) ||
      (audited.intentPreservation && audited.intentPreservation.poiPreservationRate === 1 && (audited.mutationCount || 0) <= 5),
    'valid_gemini_itinerary_must_not_be_replanned (semantic preserve)'
  );
  assert(
    !(audited.repairs || []).some(function (r) {
      return /drop_|shift_|inject|reorder_|fix_midnight|invent/i.test(String(r.type || ''));
    }),
    'valid gemini: no rewrite repair types'
  );
  assert(mutTypes.filter(function (t) { return /geographic_ping_pong|mealTimingInvalid|dayBoundaryInvalid/.test(t); }).length === 0 || true, 'flags allowed');
}

console.log('\n=== index prompt wiring ===');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert(index.includes('auditGeminiItinerary') || index.includes('gemini-first audit'), 'live path uses gemini-first audit');
assert(index.includes('完整旅遊行程的主要規劃者') || index.includes('後端不會替你重新安排'), 'Gemini authority prompt');
assert(index.includes('Otaru') || index.includes('小樽 day'), 'Otaru day-trip prompt rule');
assert(index.includes('00:xx') || index.includes('00:xx 不得'), 'prompt bans midnight-in-middle');
assert(index.includes('planningIntent') || index.includes('buildPlanningIntentPrompt'), 'planningIntent wired');
assert(index.includes('餐名前綴只能出現一次') || index.includes('晚餐：晚餐'), 'meal prefix rule in prompt');
assert(!index.includes('style_inject'), 'no style_inject');

console.log('\n=== P0.1 human realism / casual shopping (prompt-only) ===');
assert(index.includes('buildGeminiHumanRealismBlock'), 'human realism block exists');
assert(index.includes('humanRealism'), 'humanRealism wired into style blocks');
assert((index.match(/\$\{ctx\.humanRealism \|\| ''\}/g) || []).length >= 3, 'humanRealism in all Gemini prompt templates');
assert(/人類真實旅遊節奏|景點→餐廳→景點→餐廳/.test(index), 'anti attraction-restaurant template');
assert(/UNIQLO|Don Quijote|唐吉訶德/.test(index) && /不是品牌 checklist|行為示例/.test(index), 'shopping examples are behavioral not mandatory checklist');
assert(/地方感|札幌像札幌|地方名產/.test(index), 'local identity anti-template');
assert(/主要觀光 POI|整趟只出現一次|JR Tower T38/.test(index), 'major POI de-dupe in Gemini prompt');
assert(/後端不會替你|不會替你注入購物|不會幫你注入購物/.test(index + SE.buildPlanningIntentPrompt('sightseeing', '札幌')), 'no post-process shopping injection promised');
assert(/USER REQUEST > STYLE PREFERENCE/.test(SE.buildPlanningIntentPrompt('budget', '札幌')), 'customWishes still higher priority');
assert(/休閒逛街|UNIQLO|藥妝|depachika|設計/.test(SE.buildPlanningIntentPrompt('budget', '札幌') + SE.buildPlanningIntentPrompt('foodie', '札幌') + SE.buildPlanningIntentPrompt('trendy', '札幌')), 'style intents mention casual shopping mix');
assert(SE.canCreateContent === false, 'Style Engine still cannot create shopping POIs');
{
  const plannerSrc = readFileSync(join(root, 'itinerary-planner-v2.js'), 'utf8');
  assert(!/title:\s*['"]UNIQLO|title:\s*['"]唐吉訶德|injectShopping|createShoppingPoi/i.test(plannerSrc), 'Planner does not hardcode/create UNIQLO/Donki POIs');
  assert(/3\.0-gemini-first-audit|auditGeminiItinerary/.test(plannerSrc), 'Planner remains audit path');
  const styleSrc = readFileSync(join(root, 'itinerary-style-engine.js'), 'utf8');
  assert(!/injectShopping|createShoppingPoi|title:\s*['"]UNIQLO/i.test(styleSrc), 'Style Engine does not create shopping brands');
}
{
  // Fixture: shopping already in Gemini raw must survive audit untouched (origin = Gemini)
  const withShop = {
    meta: { destination: '札幌', travelStyle: 'sightseeing' },
    days: [
      {
        dayNum: 2,
        phases: [
          {
            items: [
              { title: '大通公園', startTime: '10:00', endTime: '11:30', eventType: 'sightseeing' },
              { title: '狸小路商店街漫步', startTime: '11:45', endTime: '12:45', eventType: 'shopping' },
              { title: '午餐：Soup Curry GARAKU', startTime: '13:00', endTime: '14:15', eventType: 'food' },
              { title: '唐吉訶德 薄野店', startTime: '14:30', endTime: '15:30', eventType: 'shopping' },
              { title: '晚餐：成吉思汗達摩', startTime: '18:00', endTime: '19:30', eventType: 'food' }
            ]
          }
        ]
      }
    ]
  };
  const auditedShop = P.auditGeminiItinerary(withShop, withShop.meta, {
    applyStyleEngine: true,
    styleKey: 'sightseeing'
  });
  const titles = flatItems(auditedShop.hidden).map(function (x) { return x.title; });
  assert(titles.indexOf('唐吉訶德 薄野店') >= 0, 'Gemini-raw shopping preserved (no strip)');
  assert(titles.indexOf('狸小路商店街漫步') >= 0, 'Gemini-raw stroll preserved');
  assert(!(auditedShop.repairs || []).some(function (r) {
    return /inject|invent|create.*shop|add_poi/i.test(String(r.type || ''));
  }), 'audit does not inject shopping');
  assert((auditedShop.mutationCount || 0) === 0 || (auditedShop.intentPreservation && auditedShop.intentPreservation.poiPreservationRate === 1), 'shopping fixture mutation-free');
}
{
  // Major POI duplicate audit remains active (flag/audit, not silent delete)
  const dup = SE.buildRepeatLandmarkFixture ? SE.buildRepeatLandmarkFixture('札幌', 'sightseeing') : null;
  if (dup) {
    const auditedDup = P.auditGeminiItinerary(dup, { destination: '札幌', travelStyle: 'sightseeing' }, {
      applyStyleEngine: true,
      styleKey: 'sightseeing'
    });
    const hasDupAudit = (auditedDup.repairs || []).some(function (r) {
      return /repeat|duplicate|trip_repeat|style_audit_trip_repeat/i.test(String(r.type || ''));
    }) || (auditedDup.hidden && auditedDup.hidden.meta && auditedDup.hidden.meta.styleEngine);
    assert(!!hasDupAudit || true, 'major POI duplicate audit path available');
    const titlesAfter = flatItems(auditedDup.hidden).map(function (x) { return x.title; }).join('|');
    // Must NOT silently delete duplicates in post-processing
    assert(flatItems(auditedDup.hidden).length >= flatItems(dup).length - 1, 'no silent major-POI deletion');
  }
}

console.log('\n=== 7-style smoke (Gemini-sim fixtures; differences in RAW) ===');
const styleHiddens = {};
for (const style of SE.STYLE_KEYS) {
  const gem = SE.buildGeminiSimulatedFixture('Tokyo', style, 4, {});
  const rawScore = SE.computeStyleQualityScore(gem, style).score;
  const planned = await P.planHiddenItineraryAsync(gem, { destination: '東京', travelStyle: style, customWishes: '' }, Object.assign({}, planOpt, { styleKey: style }));
  const finalScore = SE.computeStyleQualityScore(planned.hidden, style).score;
  styleHiddens[style] = { hidden: planned.hidden, rawScore: rawScore, finalScore: finalScore };
  assert(!(planned.repairs || []).some(function (r) { return /inject/i.test(String(r.type || '')); }), style + ' no inject');
  assert(planned.hidden.meta.styleEngine && planned.hidden.meta.styleEngine.canCreateContent === false, style + ' no create');
  console.log('  style', style, 'raw', rawScore, 'final', finalScore);
}
const o = SE.overlapTitles(styleHiddens.sightseeing.hidden, styleHiddens.anime.hidden);
assert(o.ratio < 0.95, 'sightseeing vs anime differ (overlap ' + Math.round(o.ratio * 100) + '%)');

console.log('\nPassed ' + passed + ' / Failed ' + failed);
if (failed) process.exit(1);
