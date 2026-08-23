/**
 * Generation-gate / preview-mode acceptance tests (no DOM).
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

function canGenerateItinerary(form) {
  if (!form.destination || !String(form.destination).trim()) return false;
  if (!form.dateStart || !form.dateEnd) return false;
  if (!form.travelStyle) return false;
  return true;
}

const bare = {
  destination: '東京',
  dateStart: '2026-08-20',
  dateEnd: '2026-08-24',
  travelStyle: 'sightseeing',
  accommodation: '',
  flightOutboundFrom: '',
  flightOutboundTo: '',
  flightDeparture: '',
  flightArrival: '',
  flightReturn: '',
  transport: ''
};
assert(canGenerateItinerary(bare) === true, '無航班＋無住宿 → 可生成');
const bareN = E.normalizeFlightPayload(bare);
assert(bareN.planningMode === 'preview', 'Preview Mode');
assert(bareN.tripMode === 'PREVIEW_TRIP_MODE', 'PREVIEW_TRIP_MODE');
assert(bareN.hardConstraints.active === false, 'Preview HARD off');
assert(bareN.previewPlan.outboundDepartureHhmm === '06:30', 'preview 06:30 dep');
assert(bareN.previewPlan.returnDepartureHhmm === '20:30', 'preview 20:30 return');
assert(
  E.hhmmToMinutes(bareN.previewPlan.estimatedArrivalHhmm) < E.hhmmToMinutes('18:00'),
  '亞洲近程 preview 抵達不得拖到晚上'
);
assert(
  E.hhmmToMinutes(bareN.buffers.earliestSightseeingHhmm) < E.hhmmToMinutes('21:30'),
  'Day1 不得 21:30 才開始'
);
assert(bareN.accommodationPlan.defaultHotelArea === '新宿', '東京住宿區域 新宿');
assert(!bareN.accommodationPlan.hotelName, '不虛構飯店名');

const destOnly = {
  destination: '東京',
  dateStart: '2026-08-20',
  dateEnd: '2026-08-24',
  travelStyle: 'sightseeing'
};
assert(canGenerateItinerary(destOnly) === true, '只有目的地＋日期＋風格 → 可生成');
assert(E.normalizeFlightPayload(destOnly).planningMode === 'preview', '核心欄 → preview');

const partial = {
  destination: '東京',
  dateStart: '2026-08-20',
  dateEnd: '2026-08-24',
  travelStyle: 'sightseeing',
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'NRT'
};
assert(canGenerateItinerary(partial) === true, '部分航班 → 可生成');
assert(E.normalizeFlightPayload(partial).planningMode === 'preview', '部分航班 → preview');
assert(E.normalizeFlightPayload(partial).hardConstraints.active === false, '部分航班 HARD off');

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
assert(n.tripMode === 'PRECISION_TRIP_MODE', 'PRECISION_TRIP_MODE');

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
assert(
  E.hhmmToMinutes(qa.hidden.days[0].phases[0].items[0].startTime) >= E.hhmmToMinutes('10:30'),
  '完整航班 08:00/10:30 → Day1 不得安排 10:30 前的目的地活動'
);

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(!indexHtml.includes('塔台呼叫機長！請填妥'), 'UI 已移除 blocking 塔台驗證文案');
assert(!/flight-departure-time"[^>]*value="14:30"/.test(indexHtml), '去程時間不再預設 14:30');
assert(/flight-departure-time"[^>]*value=""/.test(indexHtml), '去程時間預設空白');
assert(indexHtml.includes('adv-sub-outbound'), '去程 secondary accordion');
assert(indexHtml.includes('adv-sub-return'), '回程 secondary accordion');
assert(indexHtml.includes('adv-sub-stay'), '住宿與交通 secondary accordion');
assert(indexHtml.includes('z-index: 10050'), 'Auth modal 高於 City Shares');

const cfg = fs.readFileSync(path.join(root, 'firebase-config.js'), 'utf8');
const apiKeyMatch = cfg.match(/apiKey:\s*'([^']+)'/);
assert(!!apiKeyMatch, 'firebase-config 含 apiKey');
assert(/^AIzaSy/.test(apiKeyMatch[1]), 'Firebase apiKey 形狀正確');
assert(/hYUx/.test(apiKeyMatch[1]), 'Firebase apiKey 大小寫已修正');
assert(!/HYUx/.test(apiKeyMatch[1]), '舊錯誤 apiKey 已移除');
// Do not hard-code full Firebase apiKey literals in this test.

const authUi = fs.readFileSync(path.join(root, 'soarvibe-auth-ui.js'), 'utf8');
assert(authUi.includes('登入服務暫時無法使用，請稍後再試。'), 'Auth 人話錯誤');
assert(authUi.includes('humanizeAuthError'), 'Auth humanize helper');

const cs = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
assert(cs.includes("pendingAction: 'city_share_compose'"), '分享 pending action');
assert(cs.includes('Never render composer'), '未登入不 render composer');

console.log(`inspiration-precise-modes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
