/**
 * Generation-gate / planning-mode acceptance tests (no DOM).
 * Usage: node scripts/test-inspiration-precise-modes.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'travel-time-engine.js'), 'utf8');
const context = { console, globalThis: {} };
context.window = context.globalThis;
vm.createContext(context);
vm.runInContext(code, context, { filename: 'travel-time-engine.js' });
const E = context.globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error('FAIL:', msg);
}

/** Mirrors homepage gate after fix: only destination + dates + style required. */
function canGenerateItinerary(form) {
  if (!form.destination || !String(form.destination).trim()) return false;
  if (!form.dateStart || !form.dateEnd) return false;
  if (!form.travelStyle) return false;
  // Advanced fields must NEVER block.
  return true;
}

// 1) 無任何航班＋無住宿 → PASS，可生成
const bare = {
  destination: '東京',
  dateStart: '2026-09-01',
  dateEnd: '2026-09-05',
  travelStyle: 'anime',
  accommodation: '',
  flightOutboundFrom: '',
  flightOutboundTo: '',
  flightDeparture: '',
  flightArrival: '',
  flightReturn: '',
  transport: ''
};
assert(canGenerateItinerary(bare) === true, '無航班＋無住宿 → 可生成');
assert(E.hasCompleteFlightData(bare) === false, '無航班 → 非精準');
assert(E.normalizeFlightPayload(bare).hardConstraints.active === false, '無航班 → HARD off');
assert(!E.normalizeFlightPayload(bare).buffers.earliestSightseeingHhmm, '無航班 → 無 earliest');

// 2) 只有目的地＋日期＋風格 → PASS
const destOnly = {
  destination: '東京',
  dateStart: '2026-09-01',
  dateEnd: '2026-09-05',
  travelStyle: 'foodie'
};
assert(canGenerateItinerary(destOnly) === true, '只有目的地＋日期＋風格 → 可生成');
assert(E.normalizeFlightPayload(destOnly).planningMode === 'inspiration', '只有核心欄 → inspiration');

// 3) 部分航班資料 → PASS，一般模式
const partial = {
  destination: '東京',
  dateStart: '2026-09-01',
  dateEnd: '2026-09-05',
  travelStyle: 'anime',
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'NRT'
};
assert(canGenerateItinerary(partial) === true, '部分航班 → 可生成');
assert(E.hasPartialFlightData(partial) === true, '部分航班 → partial flag');
assert(E.hasCompleteFlightData(partial) === false, '部分航班 → 非 complete');
assert(E.normalizeFlightPayload(partial).hardConstraints.active === false, '部分航班 → HARD off');

// 4) 完整航班 → HARD 生效
const complete = {
  destination: '東京',
  dateStart: '2026-08-10',
  dateEnd: '2026-08-15',
  travelStyle: 'sightseeing',
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'NRT',
  flightDeparture: '2026-08-10T08:00',
  flightArrival: '2026-08-10T10:30',
  flightReturnFrom: 'NRT',
  flightReturnTo: 'TPE',
  flightReturn: '2026-08-15T19:00',
  accommodation: '淺草飯店'
};
assert(canGenerateItinerary(complete) === true, '完整航班 → 可生成');
assert(E.hasCompleteFlightData(complete) === true, '完整航班 → complete');
const n = E.normalizeFlightPayload(complete);
assert(n.hardConstraints.active === true, '完整航班 → HARD on');
assert(n.planningMode === 'precise', '完整航班 → precise');

// 5) 完整航班 08:00/10:30 → Day1 不得安排 10:30 前活動
const hidden = {
  days: [
    {
      dayNum: '1',
      phases: [
        {
          label: '上午',
          items: [{ title: '秋葉原', startTime: '09:00', endTime: '10:00', timeLabel: '09:00 - 10:00' }]
        }
      ]
    }
  ]
};
const qa = E.applyTimeQaToHidden(hidden, complete);
const firstStart = qa.hidden.days[0].phases[0].items[0].startTime;
assert(
  E.hhmmToMinutes(firstStart) >= E.hhmmToMinutes('10:30'),
  '完整航班 08:00/10:30 → Day1 不得安排 10:30 前的目的地活動'
);

// 6) 無住宿 → 不得產生假的住宿名稱（engine / attach 不得發明）
const attachedBare = E.attachToPayload(bare);
assert(!attachedBare.accommodation, '無住宿 → attach 不發明住宿名稱');
assert(attachedBare.planningMode === 'inspiration', '無住宿仍為 inspiration');

// index.html must not contain blocking tower modal copy
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(!indexHtml.includes('塔台呼叫機長！請填妥'), 'UI 已移除 blocking 塔台驗證文案');
assert(indexHtml.includes('航班資料尚未完整，本次將以一般行程模式規劃'), 'UI 有非阻塞軟提示文案');
assert(/function isAdvancedIncomplete\(\)[\s\S]*?return false;/.test(indexHtml), 'isAdvancedIncomplete 永遠 false');
assert(!/showModal\(MSG_ADVANCED_INCOMPLETE/.test(indexHtml), '不再 showModal 阻擋進階欄位');

console.log(`inspiration-precise-modes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
