/**
 * P0.4 — Gemini Day Completeness / Full-Day Coverage Guard
 * Offline prompt regressions only (no Gemini API / no paid APIs).
 * node scripts/test-p0-4-day-completeness.mjs
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
const SE = globalThis.SOARVIBE_STYLE_ENGINE;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styleSrc = fs.readFileSync(path.join(root, 'itinerary-style-engine.js'), 'utf8');
const plannerSrc = fs.readFileSync(path.join(root, 'itinerary-planner-v2.js'), 'utf8');
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
  getDayDateLabel: (_p, d) => 'Day ' + d,
  getActivityTitleFromItem: (it) => (it && (it.title || it.name)) || ''
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
  'buildGeminiMultiDayRequestText',
  'classifyTitleForTripMemory',
  'summarizePriorDays'
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

const STYLES = ['budget', 'sightseeing', 'trendy', 'foodie', 'photospot', 'anime', 'streetwear'];

console.log('\n=== helpers ===');
assert(typeof sandbox.buildGeminiDayCompletenessBlock === 'function', 'day completeness helper');
assert(typeof sandbox.hasHardFlightData === 'function', 'hasHardFlightData helper');
const dc = sandbox.buildGeminiDayCompletenessBlock();
assert(/DAY COMPLETENESS CONTRACT/.test(dc), 'contract marker');
assert(/PLANNING ASSUMPTION|COMPLETE USABLE ARRIVAL DAY/.test(dc) && /COMPLETE USABLE DEPARTURE DAY/.test(dc), 'NO-FLIGHT planning assumption arrival/departure');
assert(/presentation groups|不是 activity quotas|每時段一張卡/.test(dc), 'phases ≠ quotas');
assert(/60–90|unexplained/.test(dc), 'gap control');
assert(/6–10|meaningful events/.test(dc), 'density guidance not rigid POI count');
assert(/慢遊.*≠|≠ 空白/.test(dc), 'slow ≠ empty');
assert(/午餐＋晚餐|午餐.*晚餐/.test(dc), 'meals in completeness');
assert(/Do not repeat ≠ generate less|去重後/.test(dc), 'dup prevention ≠ sparsity');
assert(/2–3 個大區塊|2–3 張巨型卡/.test(dc), 'anti 2–3 block collapse');
assert(/跨日一致|collapsed day|Day4/.test(dc), 'cross-day density');
assert(/7 大風格|Style-aware/.test(dc), 'all styles');

console.log('\n=== 1/2 NO-FLIGHT Day1 + final day ===');
const noInfo6 = attach({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
assert(!sandbox.hasHardFlightData({ rawPayload: noInfo6, flightTimeNormalized: noInfo6.flightTimeNormalized }), 'NO-INFO hasHard=false');
const noDay1 = sandbox.buildGeminiSingleDayRequestText(noInfo6, 1, 6, '');
const noDay6 = sandbox.buildGeminiSingleDayRequestText(noInfo6, 6, 6, '');
assert(/DAY COMPLETENESS CONTRACT/.test(noDay1), 'Day1 has completeness contract');
assert(/COMPLETE USABLE ARRIVAL DAY|NO-FLIGHT PLANNING ASSUMPTION|早班抵達/.test(noDay1), 'Day1 NO-FLIGHT assumed arrival usable day');
assert(!/本日為實際抵達日——USER HARD/.test(noDay1), 'Day1 no USER HARD arrival without flight');
assert(/COMPLETE USABLE DEPARTURE DAY|晚班離境|NO-FLIGHT PLANNING ASSUMPTION/.test(noDay6), 'final day NO-FLIGHT assumed departure');
assert(!/本日為實際離境日——USER HARD/.test(noDay6), 'final day no USER HARD departure without flight');
assert(/DAY COMPLETENESS CONTRACT/.test(noDay1), 'Day1 still has completeness contract');

console.log('\n=== 3 middle-day completeness ===');
const noDay4 = sandbox.buildGeminiSingleDayRequestText(noInfo6, 4, 6, 'Day1: 時計台');
assert(/DAY COMPLETENESS CONTRACT/.test(noDay4), 'middle Day4 completeness');
assert(/禁止只輸出 2–3 個大區塊|避免整天只有 2–3/.test(noDay4), 'Day4 anti sparse outline');
assert(/unexplained long gaps|GAP CONTROL|60–90/.test(noDay4), 'gap rule on middle day');

console.log('\n=== 4–8 gap / style / slow / shopping / meals ===');
assert(/GAP CONTROL|unexplained idle gaps/.test(dc), 'unexplained-gap rule');
assert(/Style-aware completeness|7 大風格/.test(dc), 'style-aware density');
assert(/慢遊＝|≠ 空白/.test(dc), 'slow style ≠ empty');
assert(/destination-aware|不同鄰里/.test(dc), 'shopping/local fill optional destination-aware');
assert(/午餐＋晚餐|餐期/.test(dc), 'meals semantics');
for (const s of STYLES) {
  const p = attach({
    destination: '札幌',
    dateStart: '2026-11-24',
    dateEnd: '2026-11-29',
    travelStyle: s,
    customWishes: '',
    transport: 'public-transit',
    customerSelectedTransport: '大眾運輸'
  });
  const prompt = sandbox.buildGeminiSingleDayRequestText(p, 2, 6, '');
  assert(/DAY COMPLETENESS CONTRACT/.test(prompt), 'style ' + s + ' gets completeness');
}

console.log('\n=== 9–11 dup / memory / cross-day ===');
const mem = sandbox.buildGeminiTripMemoryBlock('ALREADY VISITED\nMajor POI: 時計台');
assert(/Do not repeat」≠「generate less|Do not repeat ≠ generate less|仍須維持 DAY COMPLETENESS/.test(mem), 'memory anti-sparsity');
assert(/TRIP MEMORY/.test(noDay4), 'day4 gets trip memory');
const tripChk = sandbox.buildGeminiTripLevelSelfCheckBlock();
assert(/DAY COMPLETENESS|collapsed day|2–3 個大區塊|unexplained >60/.test(tripChk), 'self-check completeness items');

console.log('\n=== 12–14 WITH-FLIGHT exceptions + P0.2 scope ===');
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
  flightArrival: '2026-11-24T22:55:00',
  departureTime: '2026-11-24T06:15:00',
  arrivalTime: '2026-11-24T22:55:00',
  flightReturnNumber: 'TR893',
  flightReturnFrom: 'CTS',
  flightReturnTo: 'TPE',
  flightReturn: '2026-11-29T18:40:00',
  returnTime: '2026-11-29T18:40:00',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
assert(sandbox.hasHardFlightData({ rawPayload: withInfo, flightTimeNormalized: withInfo.flightTimeNormalized }), 'WITH-INFO hasHard');
const w1 = sandbox.buildGeminiSingleDayRequestText(withInfo, 1, 6, '');
const w3 = sandbox.buildGeminiSingleDayRequestText(withInfo, 3, 6, '');
const w6 = sandbox.buildGeminiSingleDayRequestText(withInfo, 6, 6, '');
assert(/本日為實際抵達日/.test(w1) && /HARD CONSTRAINT|抵達日 HARD/.test(w1), 'arrival day still constrained');
assert(/partial-day|可用的 post-arrival|勿只剩一頓晚餐/.test(w1), 'arrival fills usable window');
assert(/HARD 不適用|NORMAL USABLE FULL DAY/.test(w3) && !/HARD CONSTRAINT/.test(w3), 'middle still unconstrained HARD');
assert(/本日為實際離境日/.test(w6), 'departure day constrained');
assert(/pre-departure|可用的 pre-departure|完整填滿/.test(w6), 'departure fills usable window');

console.log('\n=== 15–19 authority locks ===');
assert(/auditGeminiItinerary/.test(index), 'planner audit path');
assert(!/planHiddenItineraryAsync\s*\(\s*resolved/.test(index), 'planner cannot inject on live');
assert(SE.canCreateContent === false && SE.canMutateSchedule !== true, 'style cannot create/mutate');
assert(/GUARDRAIL: flag only|do not shift Gemini times/.test(tte), 'TimeQA flag-only');
assert(!/secondGemini|geminiCorrection|repromptGemini|correctionCall/.test(index), 'no second Gemini call marker');
assert(/Gemini 是行程內容與時間表的主要權威|sole|唯一/.test(index) || /主要權威/.test(index), 'Gemini authority wording');

console.log('\n=== 20 dynamic 3/6/10 + multi-day ===');
for (const spec of [
  { start: '2026-11-24', end: '2026-11-26', days: 3 },
  { start: '2026-11-24', end: '2026-11-29', days: 6 },
  { start: '2026-11-20', end: '2026-11-29', days: 10 }
]) {
  const p = attach({
    destination: '巴黎',
    dateStart: spec.start,
    dateEnd: spec.end,
    travelStyle: 'budget',
    customWishes: '',
    transport: 'public-transit',
    customerSelectedTransport: '大眾運輸'
  });
  const n = sandbox.countTripDays(spec.start, spec.end);
  assert(n === spec.days, 'countTripDays ' + spec.days);
  const d1 = sandbox.buildGeminiSingleDayRequestText(p, 1, n, '');
  const dLast = sandbox.buildGeminiSingleDayRequestText(p, n, n, '');
  const mid = Math.max(1, Math.floor(n / 2));
  const dMid = sandbox.buildGeminiSingleDayRequestText(p, mid, n, '');
  assert(/COMPLETE USABLE ARRIVAL DAY|NO-FLIGHT PLANNING ASSUMPTION|早班抵達/.test(d1) && !/本日為實際抵達日——USER HARD/.test(d1), spec.days + 'd Day1 assumed arrival');
  assert(/COMPLETE USABLE DEPARTURE DAY|晚班離境|NO-FLIGHT PLANNING ASSUMPTION/.test(dLast) && !/本日為實際離境日——USER HARD/.test(dLast), spec.days + 'd last assumed departure');
  assert(/DAY COMPLETENESS CONTRACT/.test(dMid), spec.days + 'd mid completeness');
  const multi = sandbox.buildGeminiMultiDayRequestText(p, 1, Math.min(3, n), n, '');
  assert(/NO-FLIGHT PLANNING ASSUMPTION|NORMAL USABLE FULL DAY|COMPLETE USABLE/.test(multi), spec.days + 'd multi no-flight gate');
  assert(/DAY COMPLETENESS/.test(multi), spec.days + 'd multi completeness wired');
}

console.log('\n=== PREVIEW engine + regions ===');
const preview = E.buildFlightHardConstraintPrompt(E.normalizeFlightPayload(noInfo6));
assert(/COMPLETE USABLE ARRIVAL DAY|早班抵達假設|NO-FLIGHT PLANNING ASSUMPTION/.test(preview), 'engine PREVIEW assumed arrival day');
assert(/COMPLETE USABLE DEPARTURE DAY|晚班離境|NORMAL USABLE FULL DAY/.test(preview), 'engine PREVIEW full-day / departure language');
assert(!/Day1 最早一般行程/.test(preview), 'engine no longer forces Day1 earliest sightseeing');
assert(!/最終日最晚離開市區/.test(preview), 'engine no longer forces final-day leave');
for (const city of ['札幌', '首爾', '曼谷', '巴黎', '紐約']) {
  const p = attach({
    destination: city,
    dateStart: '2026-11-24',
    dateEnd: '2026-11-29',
    travelStyle: 'sightseeing',
    customWishes: '',
    transport: 'public-transit',
    customerSelectedTransport: '大眾運輸'
  });
  const prompt = sandbox.buildGeminiRequestText(p);
  assert(/DAY COMPLETENESS CONTRACT/.test(prompt), 'full-trip completeness for ' + city);
}

console.log('\n=== architecture: no backend fill ===');
assert(!/appendFallbackAttraction|autoCreateShopping|injectShopping/.test(index + plannerSrc + styleSrc), 'no backend shopping inject');
assert(typeof P.auditGeminiItinerary === 'function', 'planner audit exists');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
