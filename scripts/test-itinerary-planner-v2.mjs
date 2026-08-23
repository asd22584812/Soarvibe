/**
 * Planner v2 golden + generic regression tests.
 * Run: node scripts/test-itinerary-planner-v2.mjs
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

function loadPlanner() {
  const code = readFileSync(join(root, 'itinerary-planner-v2.js'), 'utf8');
  const sandbox = { console, window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'itinerary-planner-v2.js' });
  return sandbox.SOARVIBE_PLANNER_V2;
}

function dayFromItems(dayNum, items) {
  return {
    dayNum: dayNum,
    phases: [
      {
        label: '全天',
        items: items.map(function (it) {
          return Object.assign({}, it);
        })
      }
    ]
  };
}

function hiddenFromDays(days, meta) {
  return { meta: meta || {}, days: days };
}

const P = loadPlanner();
assert(!!P, 'planner loaded');

console.log('\n=== time model ===');
const overnight = P.normalizeItemTimeModel({ startTime: '23:40', endTime: '01:10' }, 0);
assert(overnight.endDayOffset === 1, '1. 23:40-01:10 endDayOffset=1');
assert(overnight.startAbs === 23 * 60 + 40, '2. startAbs 1420');
assert(overnight.endAbs === 24 * 60 + 70, '3. endAbs 1510');
assert(overnight.crossesMidnight === true, '4. crossesMidnight');

console.log('\n=== Sapporo golden FAIL cases ===');
const sapporoBadArrival = hiddenFromDays(
  [
    dayFromItems(1, [
      { startTime: '00:40', endTime: '01:10', title: '返回住宿區域休息' },
      { startTime: '11:30', endTime: '12:30', title: '抵達新千歲機場' },
      { startTime: '14:00', endTime: '16:00', title: '大通公園' }
    ])
  ],
  { buffers: { earliestSightseeingHhmm: '13:30' } }
);
const v1 = P.validateItinerary(sapporoBadArrival, {
  flightTimeEngine: { buffers: { earliestSightseeingHhmm: '13:30' } }
});
assert(
  v1.blockers.some(function (x) {
    return x.type === 'return_before_arrival' || x.type === 'before_arrival';
  }),
  '5. return-before-airport FAIL'
);
const r1 = P.planHiddenItinerary(sapporoBadArrival, {
  flightTimeEngine: { buffers: { earliestSightseeingHhmm: '13:30' } }
});
const flat1 = [];
(r1.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) {
    flat1.push(it);
  });
});
assert(
  !flat1.some(function (it) {
    return /返回/.test(it.title || '') && P.hhmmToMinutes(it.startTime) < 13 * 60 + 30;
  }),
  '6. repair drops/shifts return before arrival'
);
assert(
  flat1.some(function (it) {
    return /新千歲|機場/.test(it.title || '');
  }),
  '7. airport arrival kept'
);

const overlapHidden = hiddenFromDays([
  dayFromItems(2, [
    { startTime: '20:00', endTime: '21:00', title: '活動 A' },
    { startTime: '20:10', endTime: '20:35', title: '活動 B' }
  ])
]);
const vOverlap = P.validateItinerary(overlapHidden, {});
assert(
  vOverlap.blockers.some(function (x) {
    return x.type === 'overlap';
  }),
  '8. overlap FAIL'
);
const rOverlap = P.planHiddenItinerary(overlapHidden, {});
const ovItems = [];
(rOverlap.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) {
    ovItems.push(it);
  });
});
ovItems.sort(function (a, b) {
  return a.startAbs - b.startAbs;
});
assert(ovItems.length >= 2, '9. overlap repair keeps items or drops unfit');
if (ovItems.length >= 2) {
  assert(
    ovItems[1].startAbs >= ovItems[0].endAbs ||
      (rOverlap.validation &&
        rOverlap.validation.issues.some(function (x) {
          return x.type === 'overlap';
        })),
    '10. after repair no overlap or overlap flagged'
  );
}

const teatimeLate = hiddenFromDays([
  dayFromItems(2, [{ startTime: '21:25', endTime: '22:25', title: '下午茶：甜點店' }])
]);
const vTea = P.validateItinerary(teatimeLate, {});
assert(
  vTea.issues.some(function (x) {
    return x.type === 'suspicious_meal_window';
  }),
  '11. 21:25 teatime suspicious'
);
const rTea = P.planHiddenItinerary(teatimeLate, {});
const teaItem = rTea.hidden.days[0].phases[0].items[0];
assert(!/下午茶/.test(teaItem.title), '12. teatime relabeled');

const dinnerLate = hiddenFromDays([
  dayFromItems(3, [{ startTime: '01:00', endTime: '02:30', title: '晚餐：根室花まる' }])
]);
const vDinner = P.validateItinerary(dinnerLate, {});
assert(
  vDinner.blockers.some(function (x) {
    return x.type === 'suspicious_meal_window';
  }),
  '13. 01:00 dinner FAIL'
);
const rDinner = P.planHiddenItinerary(dinnerLate, {});
const dItem = rDinner.hidden.days[0].phases[0].items[0];
// Guardrail: Gemini owns schedule — do not rewrite 01:00 dinner into evening
assert(
  P.hhmmToMinutes(dItem.startTime) === P.hhmmToMinutes('01:00') ||
    (rDinner.validation && rDinner.validation.issues.some(function (x) {
      return /meal|suspicious/.test(x.type || '');
    })),
  '14. late dinner flagged without forced evening rewrite'
);

const overnightOk = hiddenFromDays([
  dayFromItems(2, [
    { startTime: '21:00', endTime: '22:30', title: '薄野夜景散步' },
    { startTime: '23:40', endTime: '01:10', title: '深夜拉麵', endDayOffset: 1 }
  ])
]);
const model = P.normalizeItemTimeModel(overnightOk.days[0].phases[0].items[1], 0);
assert(model.endDayOffset === 1, '15. overnight PASS model');
const vNight = P.validateItinerary(overnightOk, {});
assert(
  !vNight.blockers.some(function (x) {
    return x.type === 'overlap';
  }),
  '16. overnight not false-overlap vs previous'
);

console.log('\n=== generic regressions ===');
function assertPass(name, hidden, meta) {
  const r = P.planHiddenItinerary(hidden, meta || {});
  assert(r.validation.ok, name + ' → validation ok after plan');
}

assertPass(
  '17. Tokyo normal day',
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '09:00', endTime: '11:00', title: '淺草寺' },
      { startTime: '11:30', endTime: '12:30', title: '午餐：天丼' },
      { startTime: '13:30', endTime: '15:30', title: '東京晴空塔' },
      { startTime: '18:00', endTime: '19:30', title: '晚餐：拉麵' },
      { startTime: '20:30', endTime: '21:00', title: '返回住宿休息' }
    ])
  ])
);

assertPass(
  '18. Seoul day',
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '10:00', endTime: '12:00', title: '景福宮', koreanName: '경복궁' },
      { startTime: '12:30', endTime: '13:30', title: '午餐：雪濃湯' },
      { startTime: '15:00', endTime: '17:00', title: '弘大商圈' },
      { startTime: '18:30', endTime: '20:00', title: '晚餐：烤肉' }
    ])
  ])
);

assertPass(
  '19. Bangkok day',
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '08:30', endTime: '10:00', title: '大皇宮' },
      { startTime: '11:00', endTime: '12:00', title: '午餐：船麵' },
      { startTime: '14:00', endTime: '16:00', title: '暹羅百麗宮' },
      { startTime: '18:00', endTime: '19:30', title: '晚餐：海鮮' }
    ])
  ])
);

const arrivalDay = hiddenFromDays(
  [
    dayFromItems(1, [
      { startTime: '08:00', endTime: '09:00', title: '早餐：飯店' },
      { startTime: '12:00', endTime: '13:00', title: '抵達仁川機場' },
      { startTime: '15:00', endTime: '17:00', title: '明洞逛街' }
    ])
  ],
  {}
);
const rArr = P.planHiddenItinerary(arrivalDay, {
  flightTimeEngine: { buffers: { earliestSightseeingHhmm: '14:30' } }
});
const arrFlat = [];
(rArr.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) {
    arrFlat.push(it);
  });
});
assert(
  !arrFlat.some(function (it) {
    return /早餐/.test(it.title) && P.hhmmToMinutes(it.startTime) < 14 * 60 + 30;
  }) ||
    (rArr.validation &&
      rArr.validation.issues.some(function (x) {
        return x.type === 'before_arrival_buffer' || x.type === 'before_arrival';
      })),
  '20. arrival day pre-arrival breakfast dropped or flagged'
);

const departDay = P.planHiddenItinerary(
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '09:00', endTime: '11:00', title: '市場散步' },
      { startTime: '14:00', endTime: '15:00', title: '前往機場' },
      { startTime: '16:00', endTime: '18:00', title: '購物Outlet' }
    ])
  ]),
  { flightTimeEngine: { buffers: { latestLeaveForAirportHhmm: '15:00' } } }
);
const depFlat = [];
(departDay.hidden.days[0].phases || []).forEach(function (ph) {
  (ph.items || []).forEach(function (it) {
    depFlat.push(it);
  });
});
assert(
  !depFlat.some(function (it) {
    return /Outlet/.test(it.title);
  }),
  '21. departure day removes city POI after airport transfer'
);

const fillerHeavy = P.planHiddenItinerary(
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '10:00', endTime: '11:00', title: '景點A' },
      { startTime: '11:20', endTime: '11:40', title: '便利商店補給' },
      { startTime: '12:00', endTime: '13:00', title: '午餐' },
      { startTime: '13:30', endTime: '14:00', title: '移動前往下一區' },
      { startTime: '14:30', endTime: '15:00', title: '藥妝採買' },
      { startTime: '16:00', endTime: '17:00', title: '景點B' },
      { startTime: '18:00', endTime: '18:30', title: '自由活動' },
      { startTime: '20:00', endTime: '20:30', title: '返回飯店休息' },
      { startTime: '21:00', endTime: '21:20', title: '再次返回飯店' }
    ])
  ]),
  {}
);
assert(
  !(fillerHeavy.repairs || []).some(function (r) {
    return /ensure_day_end_rest|inject|synthetic/i.test(String(r.type || ''));
  }),
  '22. planner does not invent synthetic filler'
);

const dupOverlapTravel = P.validateItinerary(
  hiddenFromDays([
    dayFromItems(1, [
      { startTime: '10:00', endTime: '12:00', title: '區域A景點' },
      { startTime: '12:05', endTime: '13:00', title: '遠郊區域B景點' }
    ])
  ]),
  {}
);
assert(
  dupOverlapTravel.issues.some(function (x) {
    return x.type === 'travel_buffer' || x.type === 'overlap';
  }),
  '23. travel-time conflict flagged'
);

console.log('\n=== interceptor capability ===');
assert(typeof P.planHiddenItinerary === 'function', '24. planHiddenItinerary exists');
assert(typeof P.validateItinerary === 'function', '25. validateItinerary exists');
assert(r1.intercepted === true, '26. bad Sapporo plan is intercepted before render');

console.log('\n=== source wiring ===');
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert(index.includes('itinerary-planner-v2.js'), '27. planner script tagged in index.html');
assert(index.includes('SOARVIBE_PLANNER_V2'), '28. live planHiddenItinerary hook');
assert(index.includes('抵達／離境鐵律'), '29. Gemini arrival/departure prompt rule');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
