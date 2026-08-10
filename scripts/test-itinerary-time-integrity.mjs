/**
 * Itinerary Time Integrity P0 regression tests.
 * Usage: node scripts/test-itinerary-time-integrity.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function load(name) {
  const code = fs.readFileSync(path.join(root, name), 'utf8');
  const context = { console, globalThis: {} };
  context.window = context.globalThis;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: name });
  return context.globalThis;
}

const g = load('itinerary-time-integrity.js');
const T = g.SOARVIBE_ITINERARY_TIME_INTEGRITY;

// Also load travel-time-engine with integrity present
const g2 = { console, globalThis: { SOARVIBE_ITINERARY_TIME_INTEGRITY: T } };
g2.window = g2.globalThis;
vm.createContext(g2);
vm.runInContext(
  fs.readFileSync(path.join(root, 'travel-time-engine.js'), 'utf8'),
  g2,
  { filename: 'travel-time-engine.js' }
);
const E = g2.globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;

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

// 1. 23:30–00:30 midnight normalize
{
  const tl = T.normalizeItemTimeline({ startTime: '23:30', endTime: '00:30' });
  assert(tl.crossesMidnight === true, '1a midnight flag');
  assert(tl.startAbs === 23 * 60 + 30, '1b startAbs 1410');
  assert(tl.endAbs === 24 * 60 + 30, '1c endAbs 1470');
  assert(tl.endDayOffset === 1, '1d endDayOffset +1');
}

// 2. 23:30 後不可出現同日 20:00 在最終排序前排後面
{
  const day = {
    dayNum: 1,
    phases: [
      {
        label: '晚上',
        items: [
          { title: '札幌車站周邊自由逛街', startTime: '23:30', endTime: '00:30' },
          { title: '便利商店採買', startTime: '20:00', endTime: '20:30' }
        ]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, {});
  const flat = [];
  res.day.phases.forEach((p) => (p.items || []).forEach((it) => flat.push(it)));
  assert(flat[0].title.indexOf('便利') !== -1, '2a convenience before late stroll');
  assert(flat[flat.length - 1].title.indexOf('逛街') !== -1, '2b stroll last among these');
  assert(T.assertChronological(flat), '2c chronological');
}

// 3. Day items final render chronological (multi-phase mess)
{
  const day = {
    dayNum: 2,
    phases: [
      {
        label: '晚上',
        items: [
          { title: '札幌啤酒園晚餐', startTime: '22:45', endTime: '00:45' },
          { title: '返回市中心', startTime: '19:40', endTime: '20:10' },
          { title: '藥妝店', startTime: '20:30', endTime: '21:20' }
        ]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, { styleKey: 'first-timer' });
  const flat = [];
  res.day.phases.forEach((p) => (p.items || []).forEach((it) => flat.push(it)));
  assert(T.assertChronological(flat), '3 chronological after reconcile');
  const idxs = flat.map((x) => x.title);
  assert(
    idxs.indexOf('返回市中心') < idxs.indexOf('藥妝店'),
    '3b return before drugstore'
  );
}

// 4. overlapping items repaired / no hard overlap left
{
  const day = {
    dayNum: 3,
    phases: [
      {
        label: '下午',
        items: [
          { title: 'A景點', startTime: '14:00', endTime: '16:00' },
          { title: 'B景點', startTime: '15:00', endTime: '16:30' }
        ]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, {});
  const check = T.detectTimeConflicts(
    res.day.phases.flatMap((p) => p.items || [])
  );
  const overlaps = check.issues.filter((x) => x.type === 'overlap');
  assert(overlaps.length === 0, '4 no residual overlap');
}

// 5–7 closed POI reject / shift
{
  const day = {
    dayNum: 4,
    phases: [
      {
        label: '晚上',
        items: [
          { title: '札幌時計台', startTime: '19:00', endTime: '19:40' },
          { title: '白色戀人公園', startTime: '18:55', endTime: '20:55' },
          { title: '札幌啤酒博物館', startTime: '21:45', endTime: '22:30' }
        ]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, {});
  const flat = [];
  res.day.phases.forEach((p) => (p.items || []).forEach((it) => flat.push(it)));
  const clock = flat.find((x) => /時計台/.test(x.title));
  const shiroi = flat.find((x) => /白色戀人/.test(x.title));
  const beer = flat.find((x) => /啤酒博物館/.test(x.title));
  assert(clock && T.hhmmToMinutes(clock.startTime) < 17 * 60, '5 clock tower before close');
  assert(shiroi && T.hhmmToMinutes(shiroi.startTime) < 18 * 60, '6 Shiroi Koibito not evening after close');
  assert(beer && T.hhmmToMinutes(beer.startTime) < 18 * 60, '7 Beer Museum not late night');
  assert(
    (res.report.issues || []).some((x) => x.type === 'after_hours'),
    '5-7 after_hours issues recorded'
  );
}

// 8 meal label vs time
{
  const day = {
    dayNum: 5,
    phases: [
      {
        label: '晚上',
        items: [{ title: '下午茶·甜點', startTime: '20:00', endTime: '21:00' }]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, {});
  const item = res.day.phases.flatMap((p) => p.items || [])[0];
  assert(!/下午茶/.test(item.title), '8 meal label not teatime at 20:00');
  assert(T.inferMealLabelFromMinutes(20 * 60) === '晚餐', '8b infer dinner at 20:00');
}

// 9 late dinner rejected / shifted for normal style
{
  const day = {
    dayNum: 6,
    phases: [
      {
        label: '晚上',
        items: [{ title: '晚餐·螃蟹本家', startTime: '22:35', endTime: '00:05' }]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, { styleKey: 'sightseeing' });
  const item = res.day.phases.flatMap((p) => p.items || [])[0];
  assert(T.hhmmToMinutes(item.startTime) < 22 * 60, '9 late dinner shifted earlier');
  assert(
    (res.report.fixes || []).some((x) => x.type === 'late_dinner_flag' || x.type === 'shift_dinner_earlier'),
    '9b late dinner fix recorded'
  );
}

// 10 return-to-hotel not after wrong earlier slot when unsorted
{
  const day = {
    dayNum: 7,
    phases: [
      {
        label: '晚上',
        items: [
          { title: '狸小路', startTime: '19:55', endTime: '21:55' },
          { title: '晚餐', startTime: '22:45', endTime: '00:15' },
          { title: '藥妝／唐吉訶德／便利商店', startTime: '19:30', endTime: '20:30' }
        ]
      }
    ]
  };
  const res = T.reconcileDayTimeline(day, { styleKey: 'sightseeing' });
  const flat = [];
  res.day.phases.forEach((p) => (p.items || []).forEach((it) => flat.push(it)));
  assert(T.assertChronological(flat), '10 chronological with hotel-ish errands');
  const donkiIdx = flat.findIndex((x) => /唐吉訶德|藥妝/.test(x.title));
  const tanukiIdx = flat.findIndex((x) => /狸小路/.test(x.title));
  assert(donkiIdx < tanukiIdx || donkiIdx === 0, '10b shopping not after late block wrongly');
}

// 11 supplemental merge re-sort
{
  const day = {
    dayNum: 8,
    phases: [
      {
        label: '下午',
        items: [{ title: 'AI景點', startTime: '15:00', endTime: '16:30' }]
      },
      {
        label: '晚上',
        items: [
          { title: '返回飯店休息', startTime: '22:00', endTime: '22:25' },
          { title: '便利商店採買', startTime: '21:00', endTime: '21:20' }
        ]
      }
    ]
  };
  // Simulate append then reconcile
  day.phases[1].items.push({ title: '補充卡片', startTime: '18:45', endTime: '19:30' });
  const res = T.reconcileDayTimeline(day, {});
  const flat = [];
  res.day.phases.forEach((p) => (p.items || []).forEach((it) => flat.push(it)));
  assert(T.assertChronological(flat), '11 merge then chronological');
  assert(flat[flat.length - 1].title.indexOf('返回飯店') !== -1, '11b hotel return last');
}

// 12 iPhone-style day sections: phase order 上午→下午→晚上 and within evening sorted
{
  const day = {
    dayNum: 9,
    phases: [
      {
        label: '晚上',
        items: [
          { title: '唐吉訶德', startTime: '18:45', endTime: '19:30' },
          { title: '返回住宿', startTime: '19:50', endTime: '20:20' }
        ]
      },
      {
        label: '下午',
        items: [{ title: '下午茶誤標', startTime: '20:00', endTime: '21:00' }]
      },
      {
        label: '晚上',
        items: [{ title: '晚餐', startTime: '22:35', endTime: '00:05' }]
      }
    ]
  };
  // Collapse duplicate evening by flatten reconcile
  const flattened = {
    dayNum: 9,
    phases: [
      {
        label: '晚上',
        items: day.phases.flatMap((p) => p.items || [])
      }
    ]
  };
  const res = T.reconcileDayTimeline(flattened, { styleKey: 'sightseeing' });
  assert(res.day.phases[0].label === '上午' || res.day.phases[0].label === '下午' || res.day.phases[0].label === '晚上', '12a phases rebuilt');
  const labels = res.day.phases.map((p) => p.label);
  assert(labels.join(',') === '上午,下午,晚上', '12b standard phase order');
  const evening = res.day.phases.find((p) => p.label === '晚上');
  assert(T.assertChronological(evening.items || []), '12c evening chronological');
}

// Places catalog lookup sanity
assert(!!T.lookupPoiHours('白色戀人公園'), 'catalog shiroi');
assert(!!T.lookupPoiHours('札幌ビール博物館') || !!T.lookupPoiHours('札幌啤酒博物館'), 'catalog beer museum');
assert(T.lookupPoiHours('狸小路') == null, 'tanuki unknown → conservative unknown');

// Travel-time-engine midnight overlap with integrity
{
  const hidden = {
    days: [
      {
        dayNum: 1,
        phases: [
          {
            label: '晚上',
            items: [
              { title: '深夜逛街', startTime: '23:30', endTime: '00:30' },
              { title: '便利商店採買', startTime: '20:00', endTime: '20:30' }
            ]
          }
        ]
      }
    ]
  };
  const qa = E.applyTimeQaToHidden(hidden, { customerSelectedTransport: 'public-transit' });
  const flat = [];
  qa.hidden.days[0].phases.forEach((p) => (p.items || []).forEach((it) => flat.push(it)));
  assert(T.assertChronological(flat), 'engine+integrity chronological');
}

console.log('\nPassed:', passed, 'Failed:', failed);
if (failed) process.exit(1);
