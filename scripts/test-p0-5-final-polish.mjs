/**
 * P0.5 final polish regressions (offline).
 * node scripts/test-p0-5-final-polish.mjs
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
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const uiJs = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
const uiCss = fs.readFileSync(path.join(root, 'city-shares-ui.css'), 'utf8');
const tte = fs.readFileSync(path.join(root, 'travel-time-engine.js'), 'utf8');

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
    budget: '小資旅行', sightseeing: '初次觀光', trendy: '新潮熱門', foodie: '美食吃貨',
    photospot: '網美必拍', anime: '玩具動漫', streetwear: '潮流玩家'
  },
  TRANSPORT_LABELS: { 'public-transit': '大眾運輸', 'self-drive': '自駕' },
  ALLOWED_TRANSPORT_CODES: { 'public-transit': true, 'self-drive': true },
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
  'buildGeminiPlannerPersonaBlock', 'buildGeminiHumanRealismBlock',
  'buildGeminiShortTransitCompressionBlock', 'buildGeminiTimeConsistencySelfCheckBlock',
  'buildGeminiTripLevelSelfCheckBlock', 'buildGeminiTripMemoryBlock',
  'buildGeminiDayCompletenessBlock', 'buildGeminiTimingRulesBlock',
  'buildGeminiStyleInstruction', 'ensurePayloadDiscovery', 'buildGeminiCandidateBoundBlock', 'annotateCandidateBoundDayQa', 'buildGeminiKoreaNameBlock', 'buildGeminiJsonOutputBlock',
  'classifyPlanningDayRole', 'buildGeminiTransportInstructionBlock', 'buildTransportModeLine',
  'buildGeminiStyleBlocks', 'buildGeminiFlightLogicBlock', 'buildGeminiRequestText',
  'buildGeminiSingleDayRequestText', 'normalizeAccommodationEntry', 'buildAccommodationPromptBlock', 'buildAccommodationRoutingRulesBlock',
  'splitAccommodationEntries', 'formatAccommodationNightLabel', 'buildAccommodationSegments'
].forEach((n) => {
  try { code += extractFn(index, n) + '\n'; } catch (e) { /* optional helpers */ }
});
// ensure accommodation helpers present
['normalizeAccommodationEntry', 'splitAccommodationEntries', 'formatAccommodationNightLabel', 'buildAccommodationSegments', 'buildAccommodationPromptBlock', 'buildAccommodationRoutingRulesBlock'].forEach((n) => {
  if (!code.includes('function ' + n)) {
    try { code += extractFn(index, n) + '\n'; } catch (e) { /* skip */ }
  }
});
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

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

console.log('\n=== Transport 2-only + required ===');
assert(/value="public-transit"/.test(index) && /value="self-drive"/.test(index), 'UI has transit+drive');
assert(!/value="mixed"|value="taxi-charter"|value="walk-transit"|value="soarvibe-decide"/.test(index), 'forbidden options gone');
assert(/請選擇交通方式/.test(index) && /selected disabled/.test(index), 'empty placeholder');
assert(!/transport-required-hint/.test(index) && !/請先選擇本次旅程的交通方式/.test(index), 'inline required hint removed');
assert(/function isTransportSelected\(/.test(index) && /ALLOWED_TRANSPORT_CODES/.test(index), 'transport helpers present');
assert(/getSelectedTransportCode\(/.test(index), 'payload sanitize helper');
assert(!/transports: \[[^\]]*mixed/.test(index), 'presets no mixed');
if (typeof sandbox.buildGeminiTransportInstructionBlock === 'function') {
  const legacy = sandbox.buildGeminiTransportInstructionBlock('mixed', '混合交通');
  assert(/未選擇（禁止生成）|禁止假設/.test(legacy), 'legacy mixed rejected in prompt');
  assert(/自駕/.test(sandbox.buildGeminiTransportInstructionBlock('self-drive', '自駕')), 'self-drive HARD');
} else {
  assert(/function buildGeminiTransportInstructionBlock\(/.test(index), 'transport instruction fn in source');
}
console.log('\n=== Tools grid ===');
const gridMatch = index.match(/kkday-affiliate-grid[\s\S]*?<\/div>\s*<\/div>\s*<div id="exclusive-hub-results"/);
assert(!!gridMatch, 'grid block found');
const grid = gridMatch ? gridMatch[0] : '';
const foodIdx = grid.indexOf('aria-label="景點"');
const ledgerIdx = grid.indexOf('aria-label="旅行帳本"');
const ticketIdx = grid.indexOf('aria-label="票券"');
const forexIdx = grid.indexOf('aria-label="匯率"');
assert(foodIdx >= 0 && ledgerIdx > foodIdx && ticketIdx > ledgerIdx && forexIdx > ticketIdx, 'order 景點/帳本/票券/匯率');
assert(/data-affiliate-type="foodspot"[\s\S]*?景點/.test(grid), '景點 uses foodspot handler');
assert(!/>地圖</.test(grid), '地圖 label removed from grid');
assert(/case 'foodspot':/.test(index) && /景點＆美食推薦/.test(index), 'foodspot handler retained');

console.log('\n=== Loading UX ===');
assert(/id="generating-day-progress"/.test(index), 'day progress DOM');
assert(/function setGeneratingDayProgress\(/.test(index), 'setGeneratingDayProgress');
assert(/正在安排 Day /.test(index), 'day progress copy');
assert(/generatingDayProgress = \{\s*day:\s*currentDay/.test(index), 'real day binding');
assert(/行李說它準備好了/.test(index), 'cute status retained');
assert(!/function setGeneratingDayProgress\(currentDay, totalDays, dest\) \{\s*startGeneratingStatusRotation\(dest, false\);\s*\}/.test(index), 'not stub-only');
assert(!/setInterval\([^)]*fetchGemini|secondGemini/.test(index), 'no UI-timer second request');

console.log('\n=== Perf instrumentation ===');
assert(/\[SoarVibe Perf\] STAGE/.test(index) && /payloadMs=/.test(index), 'stage timings');
assert(/soarvibePerfMarkGemini|geminiCalls/.test(index), 'gemini call counters');
assert(/totalDays >= 4[\s\S]*fetchGeminiItineraryDayByDay/.test(index), '>=4 day-by-day');
assert(/for \(var d = 1; d <= totalDays; d\+\+\)/.test(index), 'sequential days');

console.log('\n=== City Shares race ===');
assert(/shareOpenGeneration/.test(uiJs), 'generation id');
assert(/requestId !== csState\.shareOpenGeneration/.test(uiJs), 'stale guard');
assert(/shareOpenGeneration \+= 1/.test(uiJs) || /shareOpenGeneration\+\+/.test(uiJs), 'close invalidates');
assert(/這篇分享暫時載入失敗，請再試一次/.test(uiJs), 'error copy');
assert(/data-cs-retry|cs-retry-btn/.test(uiJs), 'retry button');
assert(/cs-retry-btn/.test(uiCss), 'retry css');
assert(/AbortController/.test(uiJs), 'abort support');
assert(!/location\.reload\(/.test(uiJs.match(/function openCityShares[\s\S]*?function closeCityShares/)?.[0] || ''), 'no reload in open/close');

console.log('\n=== NO-FLIGHT assumed early/late ===');
const noInfo = attach({
  destination: '札幌', dateStart: '2026-11-24', dateEnd: '2026-11-29',
  travelStyle: 'sightseeing', customWishes: '', transport: 'public-transit',
  customerSelectedTransport: '大眾運輸', accommodations: [{ name: '', checkInNight: null }]
});
const d1 = sandbox.buildGeminiSingleDayRequestText(noInfo, 1, 6, '');
const d6 = sandbox.buildGeminiSingleDayRequestText(noInfo, 6, 6, '');
const d3 = sandbox.buildGeminiSingleDayRequestText(noInfo, 3, 6, '');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 1, 6) === 'assumed-arrival', 'day1 assumed-arrival');
assert(sandbox.classifyPlanningDayRole({ rawPayload: noInfo, flightTimeNormalized: noInfo.flightTimeNormalized }, 6, 6) === 'assumed-departure', 'day6 assumed-departure');
assert(/未填航班，以下時間依早去情境預估/.test(d1), 'day1 預估 note');
assert(/airport→city|機場→市區|airport→city/.test(d1) || /airport→city|airport→city|入境／領行李/.test(d1), 'day1 airport→city flow');
assert(/未填回程航班，以下依晚回情境預估/.test(d6), 'day6 預估 note');
assert(/city→airport|前往機場|安檢/.test(d6), 'day6 city→airport');
assert(/NORMAL USABLE FULL DAY/.test(d3), 'middle full day');
assert(!/航班號|IT\d{3}|假航班/.test(d1 + d6) || /禁止捏造航班號/.test(d1), 'no fake flight numbers instructed');

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
const w1 = sandbox.buildGeminiSingleDayRequestText(withInfo, 1, 6, '');
const w6 = sandbox.buildGeminiSingleDayRequestText(withInfo, 6, 6, '');
const w3 = sandbox.buildGeminiSingleDayRequestText(withInfo, 3, 6, '');
assert(/USER HARD FLIGHT|實際抵達日/.test(w1) && /22:55/.test(w1), 'WITH-FLIGHT day1 HARD');
assert(/USER HARD FLIGHT|實際離境日/.test(w6), 'WITH-FLIGHT day6 HARD');
assert(!/COMPLETE USABLE ARRIVAL DAY——NO-FLIGHT/.test(w1), 'WITH-FLIGHT no assumed arrival');
assert(/NORMAL USABLE FULL DAY/.test(w3), 'WITH-FLIGHT middle normal');

console.log('\n=== Hotel + self-drive ===');
const hotel = sandbox.buildAccommodationPromptBlock([{ name: '', checkInNight: null }], '2026-11-24', '2026-11-29', noInfo);
assert(/CENTRAL ACCOMMODATION PLANNING ASSUMPTION/.test(hotel), 'central hotel');
assert(/示意／未訂房|禁止宣稱已訂房/.test(hotel), 'example caveats');
const driveP = attach({
  destination: '札幌', dateStart: '2026-11-24', dateEnd: '2026-11-29',
  travelStyle: 'sightseeing', transport: 'self-drive', customerSelectedTransport: '自駕',
  accommodations: [{ name: '', checkInNight: null }]
});
assert(/禁止改成 metro-first|自駕／租車/.test(sandbox.buildGeminiRequestText(driveP)), 'self-drive semantics');

console.log('\n=== API cost guards ===');
assert(!/places\.googleapis\.com|routes\.googleapis\.com/.test(index + tte), 'no Places/Routes');
assert(!/googleSearchGrounding|Research API|groundingSearch/.test(index), 'no Research/Grounding');
assert(!/secondGemini|repromptGemini|correctionCall/.test(index), 'no second Gemini correction');
assert(SE.canCreateContent === false, 'style audit-only');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
