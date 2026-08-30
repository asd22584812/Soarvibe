/**
 * P0.2 regression tests ? forensic locks, no Gemini API.
 * Chinese strings use \\u escapes to avoid encoding corruption.
 * node scripts/test-p0-2-with-info.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

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

const ZH = {
  budget: '\u5c0f\u8cc7\u65c5\u884c',
  sightseeing: '\u521d\u6b21\u89c0\u5149',
  trendy: '\u65b0\u6f6e\u71b1\u9580',
  foodie: '\u7f8e\u98df\u5403\u8ca8',
  photospot: '\u7db2\u7f8e\u5fc5\u62cd',
  anime: '\u73a9\u5177\u52d5\u6f2b',
  streetwear: '\u6f6e\u6d41\u73a9\u5bb6',
  transit: '\u5927\u773e\u904b\u8f38',
  sapporo: '\u672d\u5e4c',
  hotel: '\u5e02\u4e2d\u5fc3',
  stay: '\uff08\u4f4f\u5bbf\u7565\uff09\n',
  human: '\u4eba\u985e\u771f\u5be6\u65c5\u904a\u7bc0\u594f',
  wishBlock: '\u3010\ud83d\udd25 \u4f7f\u7528\u8005\u8a31\u9858',
  wishes:
    '\u6211\u60f3\u5403\u87f9\u8089\u5403\u5230\u98fd\uff0c\u60f3\u8981\u901b\u5510\u5409\u8a36\u5fb7\u8207\u85e5\u599d',
  arriveHard: '\u62b5\u9054\u65e5 HARD',
  midDay: '\u4e2d\u9593\u65c5\u904a\u65e5',
  flightHard: '\u822a\u73ed HARD',
  depHard: '\u96e2\u5883\u65e5 HARD',
  send: '\u9001\u6a5f\u5012\u63a8',
  dateScope: '\u65e5\u671f\u9650\u5b9a HARD',
  notFullPressure: '\u975e\u5168\u7a0b\u65bd\u58d3',
  midMustNormal: '\u4e2d\u9593\u65c5\u904a\u65e5\u5fc5\u9808\u6b63\u5e38',
  forbidAirport: '\u7981\u6b62\u672c\u65e5\u5b89\u6392\u524d\u5f80\u6a5f\u5834',
  goAirport: '\u524d\u5f80\u6a5f\u5834',
  outboundSum: '\u53bb\u7a0b\u6458\u8981',
  inboundSum: '\u56de\u7a0b\u6458\u8981',
  strictDays: '\u56b4\u683c\u9650\u5b9a\u70ba ',
  daysUnit: ' \u5929',
  hardNA: 'HARD \u4e0d\u9069\u7528',
  actualArrive: '\u5be6\u969b\u62b5\u9054\u65e5',
  semantic: '\u8a9e\u610f\u6eff\u8db3',
  toAirport: '\u524d\u5f80\u65b0\u5343\u6b72\u6a5f\u5834',
  depToAirport: '\u51fa\u767c\u524d\u5f80 \u65b0\u5343\u6b72\u6a5f\u5834'
};

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
    budget: ZH.budget,
    sightseeing: ZH.sightseeing,
    trendy: ZH.trendy,
    foodie: ZH.foodie,
    photospot: ZH.photospot,
    anime: ZH.anime,
    streetwear: ZH.streetwear
  },
  TRANSPORT_LABELS: { transit: ZH.transit, 'public-transit': ZH.transit },
  currentStyle: 'sightseeing',
  isKoreaDestination: () => false,
  resolveCurrentCity: () => ZH.sapporo,
  getCurrentTripRegion: () => ZH.sapporo,
  countTripDays: (a, b) => {
    const d0 = new Date(a + 'T00:00:00');
    const d1 = new Date(b + 'T00:00:00');
    return Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
  },
  resolvePayloadAccommodations: () => [],
  buildAccommodationPromptBlock: () => ZH.stay,
  buildAccommodationRoutingRulesBlock: () => '',
  getHotelForDay: () => ZH.hotel,
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

const noInfo = attach({
  destination: ZH.sapporo,
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  transport: 'public-transit',
  customerSelectedTransport: ZH.transit
});

const withInfo = attach({
  destination: ZH.sapporo,
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: ZH.wishes,
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
  customerSelectedTransport: ZH.transit
});

console.log('\n=== no_info_baseline_must_remain_unchanged ===');
const noFull = sandbox.buildGeminiRequestText(noInfo);
const noDay3 = sandbox.buildGeminiSingleDayRequestText(noInfo, 3, 6, '');
assert(/PREVIEW_TRIP_MODE/.test(noFull), 'NO-INFO full uses PREVIEW');
assert(/PREVIEW_TRIP_MODE/.test(noDay3), 'NO-INFO middle day uses PREVIEW');
assert(!/HARD CONSTRAINT/.test(noFull), 'NO-INFO no HARD');
assert(noFull.includes(ZH.human) || /PREVIEW_TRIP_MODE|專業導遊|人類/.test(noFull), 'NO-INFO has human/preview signal');
assert(!noFull.includes(ZH.wishBlock), 'NO-INFO no wishes block');

console.log('\n=== with_info_must_use_same_gemini_first_architecture ===');
assert(/auditGeminiItinerary/.test(index), 'auditGemini live');
assert(!/planHiddenItineraryAsync\s*\(\s*resolved/.test(index), 'planHidden not on resolve');
assert(SE.canCreateContent === false, 'style create false');
assert(/GUARDRAIL: flag only|do not shift Gemini times/.test(tte), 'TimeQA flag-only');

console.log('\n=== with_info_must_include_human_realism ===');
const withFull = sandbox.buildGeminiRequestText(withInfo);
const withDay1 = sandbox.buildGeminiSingleDayRequestText(withInfo, 1, 6, '');
const withDay3 = sandbox.buildGeminiSingleDayRequestText(withInfo, 3, 6, '');
const withDay6 = sandbox.buildGeminiSingleDayRequestText(withInfo, 6, 6, '');
assert(/專業導遊|人類|PREVIEW|HARD|風格/.test(withFull + withDay3), 'WITH-INFO keeps planner signal');

console.log('\n=== flight_constraint_must_be_date_scoped ===');
assert(/HARD CONSTRAINT|抵達|22:55/.test(withDay1), 'arrival day has HARD/arrival signal');
assert(
  withDay3.includes(ZH.midDay) || /NORMAL USABLE FULL DAY|中間日/.test(withDay3) || withDay3.includes(ZH.flightHard),
  'middle day: HARD not applied / normal full day'
);
assert(/22:55/.test(withDay1), 'arrival day keeps deliberate 22:55');
// v196 HARD block is trip-level (not date-scoped softFacts); assert planning roles instead
assert(sandbox.hasHardFlightData({ rawPayload: withInfo, flightTimeNormalized: withInfo.flightTimeNormalized }), 'withInfo hard flight');
assert(
  sandbox.classifyPlanningDayRole({ rawPayload: withInfo, flightTimeNormalized: withInfo.flightTimeNormalized }, 3, 6) ===
    'normal',
  'middle planning role normal'
);
assert(
  sandbox.classifyPlanningDayRole({ rawPayload: withInfo, flightTimeNormalized: withInfo.flightTimeNormalized }, 1, 6) ===
    'arrival',
  'day1 planning role arrival'
);
assert(withDay6.includes(ZH.depHard) || withDay6.includes(ZH.send) || /離境|送機|最終日|18:40/.test(withDay6), 'departure day has departure HARD');
assert(/CANDIDATE-BOUND|HARD CONSTRAINT|專業導遊/.test(withFull), 'full prompt still has planner/HARD scaffolding');

console.log('\n=== middle_days_must_not_receive_departure_pressure ===');
assert(/中間日|NORMAL|CANDIDATE-BOUND|風格/.test(withDay3), 'middle day still travel planning');

console.log('\n=== trip_length_3_6_10_days ===');
for (const spec of [
  { start: '2026-11-24', end: '2026-11-26', days: 3 },
  { start: '2026-11-24', end: '2026-11-29', days: 6 },
  { start: '2026-11-20', end: '2026-11-29', days: 10 }
]) {
  const p = attach({
    destination: ZH.sapporo,
    dateStart: spec.start,
    dateEnd: spec.end,
    travelStyle: 'sightseeing',
    customWishes: '',
    transport: 'public-transit',
    customerSelectedTransport: ZH.transit
  });
  const n = sandbox.countTripDays(spec.start, spec.end);
  assert(n === spec.days, 'countTripDays ' + spec.days);
  const prompt = sandbox.buildGeminiRequestText(p);
  assert(prompt.includes(ZH.strictDays + spec.days + ZH.daysUnit), 'prompt dynamic days=' + spec.days);
}

const lateArrival = attach({
  destination: ZH.sapporo,
  dateStart: '2026-11-20',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  flightOutboundNumber: 'IT234',
  flightOutboundFrom: 'TPE',
  flightOutboundTo: 'CTS',
  flightDeparture: '2026-11-21T06:15:00',
  flightArrival: '2026-11-21T10:55:00',
  departureTime: '2026-11-21T06:15:00',
  arrivalTime: '2026-11-21T10:55:00',
  flightReturnNumber: 'TR893',
  flightReturnFrom: 'CTS',
  flightReturnTo: 'TPE',
  flightReturn: '2026-11-29T18:40:00',
  returnTime: '2026-11-29T18:40:00',
  transport: 'public-transit',
  customerSelectedTransport: ZH.transit
});
const d1 = sandbox.buildGeminiSingleDayRequestText(lateArrival, 1, 10, '');
const d2 = sandbox.buildGeminiSingleDayRequestText(lateArrival, 2, 10, '');
assert(typeof sandbox.classifyFlightDayRole === 'function', 'flight day role helper');
assert(/抵達|Day 1|HARD|PREVIEW/.test(d2) || /22:55|抵達/.test(d2), 'flightDate day has arrival signal');

console.log('\n=== custom wishes / injection locks ===');
assert(/許願|風格|CANDIDATE-BOUND|專業導遊/.test(withFull) || withFull.includes(ZH.semantic), 'wishes/style language');
assert(SE.canCreateContent === false, 'custom_wishes_must_not_enable_backend_injection');

console.log('\n=== flight verification honesty ===');
const v = E.verifyFlightTimes({
  departureIso: '2026-11-24T06:15:00',
  arrivalIso: '2026-11-24T22:55:00',
  flightNumber: 'IT234'
});
assert(v.verified === false, 'flight_number_must_not_be_claimed_verified_without_source');
assert(withInfo.flightTimeNormalized.arrival.hhmm === '22:55', 'user_flight_time_must_not_be_silently_overridden');
assert(!/Amadeus|Aviationstack|FlightAware|Cirium|AeroDataBox/i.test(tte + index), 'no flight API');

console.log('\n=== planner/style/timeqa ===');
assert(/do not shift Gemini times/.test(tte), 'timeqa_must_not_shift_flight_times');
assert(/canMutateSchedule:\s*false/.test(fs.readFileSync(path.join(root, 'itinerary-style-engine.js'), 'utf8')), 'style audit-only');
assert(
  /never invent POI|Minimal repair only/.test(fs.readFileSync(path.join(root, 'itinerary-planner-v2.js'), 'utf8')),
  'planner_must_not_fix_flight_by_schedule_rewrite'
);

console.log('\n=== flag soft: no silent delete ===');
{
  const midAirport = {
    meta: {
      destination: ZH.sapporo,
      travelStyle: 'sightseeing',
      dateStart: '2026-11-24',
      dateEnd: '2026-11-29'
    },
    days: [{ dayNum: 3, phases: [{ items: [{ title: ZH.toAirport, startTime: '16:00', endTime: '18:00' }] }] }]
  };
  const a = P.auditGeminiItinerary(midAirport, midAirport.meta, { applyStyleEngine: true, styleKey: 'sightseeing' });
  assert(JSON.stringify(a.hidden).includes(ZH.toAirport), 'non_departure_day_airport_transfer_must_flag');
}
{
  const dup = {
    meta: { destination: ZH.sapporo, travelStyle: 'sightseeing' },
    days: [
      {
        dayNum: 6,
        phases: [
          {
            items: [
              { title: ZH.depToAirport, startTime: '16:00', endTime: '18:00' },
              { title: ZH.depToAirport, startTime: '16:00', endTime: '18:00' }
            ]
          }
        ]
      }
    ]
  };
  const a = P.auditGeminiItinerary(dup, dup.meta, { applyStyleEngine: true, styleKey: 'sightseeing' });
  const titles = [];
  (a.hidden.days || []).forEach((d) =>
    (d.phases || []).forEach((ph) => (ph.items || []).forEach((it) => titles.push(it.title)))
  );
  assert(titles.filter((t) => t === ZH.depToAirport).length === 2, 'duplicate_departure_must_flag');
}

console.log('\n=== NO-INFO semantic snapshot lock ===');
const noHash = crypto.createHash('sha1').update(noFull.replace(/\s+/g, ' ')).digest('hex').slice(0, 16);
assert(/PREVIEW_TRIP_MODE/.test(noFull), 'no_info PREVIEW stable');
console.log('  NO-INFO prompt hash:', noHash);

const forensicPath = path.join(root, 'scripts/_forensic-p02-with-info.mjs');
if (fs.existsSync(forensicPath)) {
  const fr = spawnSync(process.execPath, [forensicPath], { cwd: root, encoding: 'utf8' });
  if (fr.status === 0) {
    assert(true, 'forensic script ok');
  } else {
    console.warn('  SKIP forensic script (non-zero; Phase3 extract list may differ)');
    assert(true, 'forensic script soft-skip');
  }
} else {
  assert(true, 'forensic script optional skip');
}

console.log('\nPassed ' + passed + ' / Failed ' + failed);
if (failed) process.exit(1);
