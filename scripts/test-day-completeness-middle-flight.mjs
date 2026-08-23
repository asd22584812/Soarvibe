/**
 * Offline CASE A–D: middle-day ZERO flight softFacts + Day Completeness QA.
 * node scripts/test-day-completeness-middle-flight.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log('  OK ', msg);
    passed++;
  } else {
    console.error('  FAIL', msg);
    failed++;
  }
}

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(path.join(root, 'travel-time-engine.js'));
require(path.join(root, 'itinerary-destination-intelligence.js'));
require(path.join(root, 'itinerary-style-engine.js'));
require(path.join(root, 'itinerary-planner-v2.js'));
const E = globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;
const P = globalThis.SOARVIBE_PLANNER_V2;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const sandbox = {
  window: globalThis,
  console,
  TRAVEL_STYLE_LABELS: {
    budget: '小資旅行',
    sightseeing: '初次觀光',
    trendy: '新潮熱門',
    foodie: '美食吃貨',
    photospot: '網美必拍',
    anime: '玩具動漫',
    streetwear: '潮流玩家'
  },
  TRANSPORT_LABELS: { transit: '大眾運輸', 'public-transit': '大眾運輸' },
  currentStyle: 'sightseeing',
  isKoreaDestination: () => false,
  resolveCurrentCity: () => '札幌',
  getCurrentTripRegion: () => '札幌',
  countTripDays: (a, b) => {
    const d0 = new Date(a + 'T00:00:00');
    const d1 = new Date(b + 'T00:00:00');
    return Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
  },
  resolvePayloadAccommodations: () => [],
  buildAccommodationPromptBlock: () => '（住宿略）\n',
  buildAccommodationRoutingRulesBlock: () => '',
  getHotelForDay: () => '市中心',
  getDayDateLabel: (_p, d) => 'Day ' + d
};

let code = '"use strict";\n';
[
  'buildFlightLegSummary',
  'formatFlightDateTime',
  'buildFlightPromptDetails',
  'isoDateOnly',
  'tripDayDateIso',
  'classifyFlightDayRole',
  'buildGeminiPlannerPersonaBlock',
  'buildGeminiHumanRealismBlock',
  'buildGeminiShortTransitCompressionBlock',
  'buildGeminiTimeConsistencySelfCheckBlock',
  'buildGeminiTripLevelSelfCheckBlock',
  'buildGeminiTripMemoryBlock',
  'buildGeminiDayCompletenessBlock',
  'hasHardFlightData',
  'buildGeminiTimingRulesBlock',
  'buildGeminiStyleInstruction',
  'ensurePayloadDiscovery',
  'buildGeminiCandidateBoundBlock',
  'annotateCandidateBoundDayQa',
  'buildGeminiKoreaNameBlock',
  'buildGeminiJsonOutputBlock',
  'classifyPlanningDayRole',
  'buildGeminiTransportInstructionBlock',
  'buildTransportModeLine',
  'buildGeminiStyleBlocks',
  'buildGeminiFlightLogicBlock',
  'buildGeminiRequestText',
  'buildGeminiSingleDayRequestText',
  'buildGeminiMultiDayRequestText'
].forEach((n) => {
  code += extractFn(index, n) + '\n';
});
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function attach(raw) {
  const p = { ...raw };
  const hasUserFlight = !!(
    p.flightArrival ||
    p.arrivalTime ||
    p.flightReturn ||
    p.returnTime ||
    p.flightOutboundNumber ||
    p.flightReturnNumber
  );
  p.flightMode = hasUserFlight ? 'user_provided' : 'assumed';
  if (!hasUserFlight) {
    p.arrivalAssumption = 'morning';
    p.departureAssumption = 'evening';
  }
  return E.attachToPayload(p);
}

const withInfo = attach({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  flightOutboundNumber: 'IT234',
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'CTS',
  flightDeparture: '2026-11-24T06:15:00',
  flightArrival: '2026-11-24T10:55:00',
  departureTime: '2026-11-24T06:15:00',
  arrivalTime: '2026-11-24T10:55:00',
  flightReturnNumber: 'TR893',
  flightReturnFrom: 'CTS',
  flightReturnTo: 'TPE',
  flightReturn: '2026-11-29T18:40:00',
  returnTime: '2026-11-29T18:40:00',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});

const noInfo = attach({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});

console.log('\n=== CASE A: 6-day Sapporo WITH flights ===');
const a1 = sandbox.buildGeminiSingleDayRequestText(withInfo, 1, 6, '');
const a2 = sandbox.buildGeminiSingleDayRequestText(withInfo, 2, 6, '');
const a3 = sandbox.buildGeminiSingleDayRequestText(withInfo, 3, 6, '');
const a4 = sandbox.buildGeminiSingleDayRequestText(withInfo, 4, 6, '');
const a5 = sandbox.buildGeminiSingleDayRequestText(withInfo, 5, 6, '');
const a6 = sandbox.buildGeminiSingleDayRequestText(withInfo, 6, 6, '');

assert(/抵達日 HARD|USER HARD FLIGHT|實際抵達日/.test(a1), 'A Day1 arrival HARD');
assert(/10:55/.test(a1), 'A Day1 has arrival time 10:55');
for (const [n, p] of [
  [2, a2],
  [3, a3],
  [4, a4],
  [5, a5]
]) {
  assert(/NORMAL USABLE FULL DAY|中間旅遊日/.test(p), 'A Day' + n + ' normal full day');
  assert(!/🛫 去程：|🛬 回程：|航班事實|去程摘要|回程摘要/.test(p), 'A Day' + n + ' ZERO softFacts');
  assert(!/06:15|10:55|18:40/.test(p), 'A Day' + n + ' no flight clock times');
  assert(!/\bTPE\b|\bCTS\b|IT234|TR893/.test(p), 'A Day' + n + ' no airport/flight codes');
}
assert(/離境日 HARD|實際離境日|送機倒推/.test(a6), 'A Day6 departure HARD');
assert(/18:40/.test(a6), 'A Day6 has return departure time');

console.log('\n=== CASE B: 6-day Sapporo NO flights ===');
const b1 = sandbox.buildGeminiSingleDayRequestText(noInfo, 1, 6, '');
const b3 = sandbox.buildGeminiSingleDayRequestText(noInfo, 3, 6, '');
const b6 = sandbox.buildGeminiSingleDayRequestText(noInfo, 6, 6, '');
const bFull = sandbox.buildGeminiRequestText(noInfo);
assert(/PREVIEW_TRIP_MODE|NO-FLIGHT PLANNING ASSUMPTION/.test(b1), 'B Day1 preview/assumed arrival');
assert(/PREVIEW_TRIP_MODE|NO-FLIGHT|NORMAL USABLE FULL DAY/.test(b3), 'B middle preview/normal');
assert(/PREVIEW_TRIP_MODE|NO-FLIGHT PLANNING ASSUMPTION|COMPLETE USABLE DEPARTURE/.test(b6), 'B Day6 assumed departure');
assert(/PREVIEW_TRIP_MODE/.test(bFull), 'B full prompt PREVIEW');
assert(!/HARD CONSTRAINT/.test(b3), 'B middle no HARD CONSTRAINT');

console.log('\n=== CASE C: sparse 3-block day → severe ===');
assert(typeof P.evaluateDayCompletenessQa === 'function', 'evaluateDayCompletenessQa exported');
const sparseDay = {
  day: 5,
  phases: [
    {
      period: '上午',
      items: [{ time: '09:00 - 10:00', title: '早餐：椿サロン 大通店', highlight: 'x', note: 'y' }]
    },
    {
      period: '下午',
      items: [{ time: '13:00 - 15:30', title: '小樽音樂盒堂 LeTAO 起司蛋糕', highlight: 'x', note: 'y' }]
    },
    {
      period: '晚上',
      items: [{ time: '18:00 - 20:30', title: '札幌在地晚餐或夜景', highlight: 'x', note: 'y' }]
    }
  ]
};
const qaC = P.evaluateDayCompletenessQa(sparseDay, { planningRole: 'middle', payload: withInfo });
assert(qaC.severe === true, 'C severe=true');
assert(qaC.meaningfulItemCount <= 3, 'C meaningful <= 3 (' + qaC.meaningfulItemCount + ')');
assert((qaC.longGaps || []).length >= 1, 'C has unexplained long gaps (' + (qaC.longGaps || []).length + ')');
assert(/maybeReplanDayForCompleteness/.test(index), 'C replan wired in index');
assert(/keep second result|still severe after 1 replan/.test(index), 'C max 1 replan / keep second');

const qaArrival = P.evaluateDayCompletenessQa(sparseDay, {
  planningRole: 'arrival',
  payload: withInfo
});
assert(qaArrival.severe === false && qaArrival.eligible === false, 'C not applied to arrival day');

console.log('\n=== CASE D: dense day → no replan ===');
const denseDay = {
  day: 5,
  phases: [
    {
      period: '上午',
      items: [
        { time: '09:00 - 09:45', title: '早餐：大通市場', highlight: 'x', note: 'y' },
        { time: '10:00 - 11:30', title: '北海道庁旧本庁舎', highlight: 'x', note: '步行10分' },
        { time: '11:40 - 12:40', title: '午餐：Soup Curry', highlight: 'x', note: '徒歩8分' }
      ]
    },
    {
      period: '下午',
      items: [
        { time: '13:00 - 14:30', title: '大通公園散步與電視塔周邊', highlight: 'x', note: 'y' },
        { time: '14:45 - 16:00', title: '北海道大学構内・イチョウ並木', highlight: 'x', note: '地下鉄15分' },
        { time: '16:15 - 17:30', title: '狸小路商店街購物', highlight: 'x', note: '徒歩12分' }
      ]
    },
    {
      period: '晚上',
      items: [
        { time: '18:00 - 19:30', title: '晚餐：ジンギスカン', highlight: 'x', note: 'y' },
        { time: '20:00 - 21:00', title: 'すすきの夜景散策', highlight: 'x', note: '徒歩10分' }
      ]
    }
  ]
};
const qaD = P.evaluateDayCompletenessQa(denseDay, { planningRole: 'middle', payload: withInfo });
assert(qaD.severe === false, 'D severe=false');
assert(qaD.meaningfulItemCount >= 5, 'D meaningful >= 5 (' + qaD.meaningfulItemCount + ')');
assert((qaD.longGaps || []).length === 0, 'D no unexplained long gaps');

console.log('\n=== wiring / debug hooks ===');
assert(/不套用任何航班 HARD|本日不是抵達日/.test(index), 'middle zero-flight wording in source');
assert(/__SOARVIBE_GEMINI_DEBUG__/.test(index), 'debug state hook');
assert(/\[SOARVIBE\]\[Gemini Raw Day\]/.test(index), 'raw day console tag');
assert(/\[SOARVIBE\]\[Day Completeness QA\]/.test(index), 'QA console tag');
assert(/buildGeminiDayCompletenessReplanPrompt/.test(index), 'replan prompt builder');

console.log('\n==== RESULT passed=' + passed + ' failed=' + failed + ' ====');
if (failed) process.exit(1);
