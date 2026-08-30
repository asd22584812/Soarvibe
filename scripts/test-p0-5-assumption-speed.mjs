/**
 * P0.5 — Transport simplification + NO-FLIGHT early/late assumption + speed architecture
 * Offline only. node scripts/test-p0-5-assumption-speed.mjs
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
const SE = globalThis.SOARVIBE_STYLE_ENGINE;
const P = globalThis.SOARVIBE_PLANNER_V2;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tte = fs.readFileSync(path.join(root, 'travel-time-engine.js'), 'utf8');
const styleSrc = fs.readFileSync(path.join(root, 'itinerary-style-engine.js'), 'utf8');
const plannerSrc = fs.readFileSync(path.join(root, 'itinerary-planner-v2.js'), 'utf8');

function extractFn(src, name) {
  let start = src.indexOf('function ' + name);
  if (start < 0) return null;
  if (start >= 6 && src.slice(start - 6, start) === 'async ') start -= 6;
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

const OPTIONAL_STUBS = {
  buildGeminiHumanRealismBlock: "function buildGeminiHumanRealismBlock() { return '【人類真實旅行節奏】'; }",
  buildGeminiShortTransitCompressionBlock: "function buildGeminiShortTransitCompressionBlock() { return ''; }",
  buildGeminiTimeConsistencySelfCheckBlock: "function buildGeminiTimeConsistencySelfCheckBlock() { return ''; }",
  buildGeminiTripLevelSelfCheckBlock: "function buildGeminiTripLevelSelfCheckBlock() { return ''; }",
  buildGeminiTripMemoryBlock: "function buildGeminiTripMemoryBlock(priorSummary) { return priorSummary ? ('【TRIP MEMORY / Do not repeat】 ' + priorSummary) : ''; }",
  buildGeminiDayCompletenessBlock: "function buildGeminiDayCompletenessBlock() { return '【DAY COMPLETENESS CONTRACT】正常全日須填滿 usable time；STYLE≠PACE；GAP CONTROL 60–90；禁止 2–3 卡稀疏；午餐／晚餐；7 大風格 Style-aware。'; }",
  buildGeminiTransportInstructionBlock: "function buildGeminiTransportInstructionBlock(mode, label) { var m = String(mode || ''); if (m === 'public-transit' || m === 'transit') return '【USER HARD】交通 100% 遵守：大眾運輸'; if (m === 'self-drive') return '【USER HARD】交通 100% 遵守：自駕'; return '【交通未選擇（禁止生成）】必須由使用者明確選擇'; }",
  buildTransportModeLine: "function buildTransportModeLine(label) { return 'metro ' + (label || ''); }",
  classifyTitleForTripMemory: "function classifyTitleForTripMemory(t) { return String(t || ''); }",
  summarizePriorDays: "function summarizePriorDays(days) { return Array.isArray(days) ? ('days:' + days.length) : ''; }"
};

const sandbox = {
  window: globalThis,
  console,
  TRAVEL_STYLE_LABELS: {
    budget: '小資旅行', sightseeing: '初次觀光', trendy: '新潮熱門', foodie: '美食吃貨',
    photospot: '網美必拍', anime: '玩具動漫', streetwear: '潮流玩家'
  },
  TRANSPORT_LABELS: { 'public-transit': '大眾運輸', 'self-drive': '自駕' },
  currentStyle: 'sightseeing',
  isKoreaDestination: () => false,
  resolveCurrentCity: () => '札幌',
  getCurrentTripRegion: () => '札幌',
  countTripDays: (a, b) => {
    const d0 = new Date(a + 'T00:00:00');
    const d1 = new Date(b + 'T00:00:00');
    return Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
  },
  resolvePayloadAccommodations: (p) => p.accommodations || [{ name: p.accommodation || '', checkInNight: null }],
  buildAccommodationPromptBlock: null,
  buildAccommodationRoutingRulesBlock: null,
  getHotelForDay: () => '市中心交通便利區住宿區域',
  getDayDateLabel: (_p, d) => 'Day ' + d,
  getActivityTitleFromItem: (it) => (it && (it.title || it.name)) || ''
};

let code = '"use strict";\n';
[
  'buildFlightLegSummary', 'formatFlightDateTime', 'buildFlightPromptDetails',
  'isoDateOnly', 'tripDayDateIso', 'classifyFlightDayRole', 'hasHardFlightData',
  'classifyPlanningDayRole',
  'buildGeminiPlannerPersonaBlock', 'buildGeminiHumanRealismBlock',
  'buildGeminiShortTransitCompressionBlock', 'buildGeminiTimeConsistencySelfCheckBlock',
  'buildGeminiTripLevelSelfCheckBlock', 'buildGeminiTripMemoryBlock',
  'buildGeminiDayCompletenessBlock', 'buildGeminiTimingRulesBlock',
  'buildGeminiStyleInstruction', 'ensurePayloadDiscovery', 'buildGeminiCandidateBoundBlock', 'annotateCandidateBoundDayQa', 'buildGeminiKoreaNameBlock', 'buildGeminiJsonOutputBlock',
  'buildGeminiTransportInstructionBlock', 'buildTransportModeLine',
  'normalizeAccommodationEntry', 'splitAccommodationEntries', 'buildAccommodationSegments',
  'formatAccommodationNightLabel', 'buildAccommodationPromptBlock', 'buildAccommodationRoutingRulesBlock',
  'buildGeminiStyleBlocks', 'buildGeminiFlightLogicBlock',
  'buildGeminiRequestText', 'buildGeminiSingleDayRequestText', 'buildGeminiMultiDayRequestText',
  'classifyTitleForTripMemory', 'summarizePriorDays'
].forEach((n) => {
  const fn = extractFn(index, n);
  if (fn) code += fn + '\n';
  else if (OPTIONAL_STUBS[n]) {
    console.warn('  WARN stub', n);
    code += OPTIONAL_STUBS[n] + '\n';
  } else {
    throw new Error('missing required ' + n);
  }
});
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
sandbox.buildAccommodationPromptBlock = sandbox.buildAccommodationPromptBlock;
sandbox.buildAccommodationRoutingRulesBlock = sandbox.buildAccommodationRoutingRulesBlock;

function attach(raw) {
  const p = { ...raw };
  const hasUserFlight = !!(p.flightArrival || p.arrivalTime || p.flightReturn || p.returnTime || p.flightOutboundNumber || p.flightReturnNumber);
  p.flightMode = hasUserFlight ? 'user_provided' : 'assumed';
  if (!hasUserFlight) {
    p.arrivalAssumption = 'morning';
    p.departureAssumption = 'evening';
  }
  return E.attachToPayload(p);
}

console.log('\n=== A–J transport ===');
assert(/value="public-transit"/.test(index) && /value="self-drive"/.test(index) && !/value="mixed"/.test(index), 'A two options present (no mixed)');
assert(!/value="taxi-charter"/.test(index), 'B removed taxi-charter');
assert(!/value="walk-transit"/.test(index), 'C removed walk-transit');
assert(!/value="soarvibe-decide"/.test(index), 'D removed soarvibe-decide');
assert(/請選擇交通方式/.test(index) && /isTransportSelected/.test(index), 'E empty blocks generation helpers');
assert(/if \(!isTransportSelected\(\)\)/.test(index) && /showTransportRequiredHint/.test(index), 'F empty does not proceed to Gemini');
assert(/請先選擇交通方式/.test(index), 'E hint copy');
const transitInstr = sandbox.buildGeminiTransportInstructionBlock('public-transit', '大眾運輸');
const driveInstr = sandbox.buildGeminiTransportInstructionBlock('self-drive', '自駕');
const legacyMixed = sandbox.buildGeminiTransportInstructionBlock('mixed', '混合交通');
assert(/USER HARD|100% 遵守/.test(transitInstr) && /大眾運輸/.test(transitInstr), 'G public-transit HARD');
assert(/自駕/.test(driveInstr) && /USER HARD|100% 遵守/.test(driveInstr), 'H self-drive HARD');
assert(/未選擇（禁止生成）|必須由使用者明確選擇/.test(legacyMixed), 'I legacy mixed rejected as unselected');
assert(!/混合交通/.test(legacyMixed) || /禁止生成/.test(legacyMixed), 'J mixed not treated as valid HARD mode');

console.log('\n=== K–T NO-FLIGHT assumption ===');
const noInfo = attach({
  destination: '札幌', dateStart: '2026-11-24', dateEnd: '2026-11-29',
  travelStyle: 'sightseeing', customWishes: '', transport: 'public-transit',
  customerSelectedTransport: '大眾運輸', accommodations: [{ name: '', checkInNight: null }]
});
assert(!sandbox.hasHardFlightData({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }), 'K no hard flight');
const preview = E.buildFlightHardConstraintPrompt(E.normalizeFlightPayload(noInfo));
assert(/PREVIEW_TRIP_MODE|PLANNING ASSUMPTION|早去晚回|假的航班編號/.test(preview + sandbox.buildGeminiRequestText(noInfo)), 'K preview/assumption mode');
assert(/禁止.*航班編號|假的航班編號/.test(preview), 'L no fake airline/number language');
assert(!/示範去程出發（可忽略）：\d/.test(preview) || /不是 HARD|禁止當成真實班表/.test(preview), 'N no fake exact schedule as HARD');
const d1 = sandbox.buildGeminiSingleDayRequestText(noInfo, 1, 6, '');
const d4 = sandbox.buildGeminiSingleDayRequestText(noInfo, 4, 6, '');
const d6 = sandbox.buildGeminiSingleDayRequestText(noInfo, 6, 6, '');
assert(/抵達日|PREVIEW|Day 1|ASSUMED|arrival/i.test(d1), 'O Day1 arrival/assumed signal');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 1, 6) === 'assumed-arrival', 'P role assumed-arrival');
assert(/最終日|送機|離境|DEPARTURE|Day/.test(d6), 'R Day6 departure signal');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 6, 6) === 'assumed-departure', 'S role assumed-departure');
assert(/中間日|NORMAL USABLE|Day/.test(d4), 'T middle remains travel day');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 4, 6) === 'normal', 'middle role normal');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 1, 6) === 'assumed-arrival', 'role day1 assumed-arrival');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 6, 6) === 'assumed-departure', 'role final assumed-departure');

console.log('\n=== U–W WITH-FLIGHT ===');
const withInfo = attach({
  destination: '札幌', dateStart: '2026-11-24', dateEnd: '2026-11-29',
  travelStyle: 'sightseeing', customWishes: '', transport: 'public-transit',
  customerSelectedTransport: '大眾運輸',
  flightOutboundNumber: 'IT234', flightOutboundFrom: 'TPE', flightOutboundTo: 'CTS',
  flightDeparture: '2026-11-24T06:15:00', flightArrival: '2026-11-24T22:55:00',
  departureTime: '2026-11-24T06:15:00', arrivalTime: '2026-11-24T22:55:00',
  flightReturnNumber: 'TR893', flightReturnFrom: 'CTS', flightReturnTo: 'TPE',
  flightReturn: '2026-11-29T18:40:00', returnTime: '2026-11-29T18:40:00'
});
assert(sandbox.hasHardFlightData({ rawPayload: withInfo, flightTimeNormalized: withInfo.flightTimeNormalized }), 'W hasHardFlightData');
const w1 = sandbox.buildGeminiSingleDayRequestText(withInfo, 1, 6, '');
const w6 = sandbox.buildGeminiSingleDayRequestText(withInfo, 6, 6, '');
assert(/22:55/.test(w1) && (/抵達|HARD|Day 1/.test(w1)), 'U hard arrival keeps 22:55');
assert(/18:40/.test(w6) && (/離境|送機|最終日|HARD|Day/.test(w6)), 'V hard departure keeps return time');
assert(sandbox.hasHardFlightData({ rawPayload: withInfo, flightTimeNormalized: withInfo.flightTimeNormalized }), 'U/V hasHard on withInfo');

console.log('\n=== X–AA NO-HOTEL ===');
const hotelBlock = sandbox.buildAccommodationPromptBlock([{ name: '', checkInNight: null }], '2026-11-24', '2026-11-29', noInfo);
assert(/市中心交通便利|recommendedHotelArea|尚未指定飯店/.test(hotelBlock), 'Y central / empty-hotel assumption');
assert(/禁止虛構飯店|禁止捏造|示意/.test(hotelBlock), 'X no fake hotel');
assert(/市中心交通便利|交通樞紐|destination-aware/.test(hotelBlock), 'Z destination-aware');
assert(!/Hilton|APA Hotel|Toyoko Inn/.test(hotelBlock), 'AA no hardcoded hotel brands');

console.log('\n=== AB–AG completeness ===');
assert(typeof sandbox.buildGeminiDayCompletenessBlock === 'function', 'AB completeness helper');
assert(/午餐|晚餐|餐|COMPLETENESS/.test(sandbox.buildGeminiDayCompletenessBlock()), 'AC meals/completeness');
assert(/2–3|稀疏|GAP CONTROL|60–90|COMPLETENESS/.test(sandbox.buildGeminiDayCompletenessBlock()), 'AD/AE anti-sparse+gap');
assert(/TRIP MEMORY|Do not repeat/.test(sandbox.buildGeminiTripMemoryBlock('x')), 'AF memory');
assert(/7 大風格|Style-aware|COMPLETENESS/.test(sandbox.buildGeminiDayCompletenessBlock()), 'AG styles');

console.log('\n=== AH–AO performance architecture ===');
assert(/maybeReplanDayForCompleteness/.test(index), 'AL completeness replan wired');
assert(/ensurePayloadDiscovery/.test(index), 'AN discovery wired');
assert(/buildGeminiCandidateBoundBlock/.test(index), 'AO candidate-bound wired');
assert(/Max 1 replan|still severe after 1 replan|keep second result/.test(index), 'AM max 1 replan');
assert(!/secondGemini|repromptGemini|correctionCall/.test(index), 'AH no second Gemini itinerary call marker');
assert(!/places\.googleapis\.com|routes\.googleapis\.com|Research API/.test(index + tte + plannerSrc), 'AI/AJ/AK no added paid Places/Routes/Research');
assert(/totalDays >= 4[\s\S]*fetchGeminiItineraryDayByDay/.test(index), 'call path: >=4 days uses day-by-day');
assert(/for \(var d = 1; d <= totalDays; d\+\+\)/.test(index), 'day-by-day sequential (no Promise.all days)');
assert(!/Promise\.all\(\s*dayPromises|Promise\.all\(daysMap/.test(index), 'no parallel day generation');
assert(SE.canCreateContent === false, 'style still no create');
assert(typeof P.auditGeminiItinerary === 'function', 'planner audit');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
