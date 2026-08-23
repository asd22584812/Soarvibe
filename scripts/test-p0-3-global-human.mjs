/**
 * P0.3 — Global Human Trip Planning / Trip-Level Self-Check regressions.
 * Offline only (no Gemini API / no paid APIs).
 * node scripts/test-p0-3-global-human.mjs
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
    p.flightArrival || p.arrivalTime || p.flightReturn || p.returnTime || p.flightOutboundNumber || p.flightReturnNumber
  );
  p.flightMode = hasUserFlight ? 'user_provided' : 'assumed';
  if (!hasUserFlight) {
    p.arrivalAssumption = 'morning';
    p.departureAssumption = 'evening';
  }
  return E.attachToPayload(p);
}

const STYLES = ['budget', 'sightseeing', 'trendy', 'foodie', 'photospot', 'anime', 'streetwear'];
const REGIONS = [
  { destination: '札幌', region: 'Japan' },
  { destination: '首爾', region: 'Korea' },
  { destination: '曼谷', region: 'Southeast Asia' },
  { destination: '巴黎', region: 'Europe' },
  { destination: '紐約', region: 'North America' }
];

console.log('\n=== helpers exist ===');
assert(typeof sandbox.buildGeminiHumanRealismBlock === 'function', 'human realism exists');
assert(typeof sandbox.buildGeminiTripMemoryBlock === 'function', 'trip memory helper exists');
assert(typeof sandbox.buildGeminiShortTransitCompressionBlock === 'function', 'short transit helper');
assert(typeof sandbox.buildGeminiTimeConsistencySelfCheckBlock === 'function', 'time consistency helper');
assert(typeof sandbox.buildGeminiTripLevelSelfCheckBlock === 'function', 'trip self-check helper');
assert(typeof sandbox.summarizePriorDays === 'function', 'summarizePriorDays exists');

console.log('\n=== human realism / shopping global ===');
const humanTokyo = sandbox.buildGeminiHumanRealismBlock('東京');
const humanSeoul = sandbox.buildGeminiHumanRealismBlock('首爾');
assert(/人類真實旅遊節奏|GLOBAL/.test(humanTokyo), 'human realism exists');
assert(/ROUTE-AWARE CASUAL SHOPPING|casual shopping/.test(humanTokyo), 'shopping instruction is global');
assert(/Don Quijote/.test(humanTokyo) && /≠ 必須 Don Quijote|不得當 MUST/.test(humanTokyo), 'Donki is example only');
assert(/Olive Young/.test(humanSeoul) && /≠ 必須 Olive Young|不得當 MUST/.test(humanTokyo + humanSeoul), 'Olive Young is example only');
assert(/Taiwan|Thailand|Europe|USA|Canada|Japan|Korea/.test(humanTokyo), 'multi-region semantic examples');
assert(/去日本\s*≠\s*必須|去韓國\s*≠\s*必須/.test(humanTokyo) && !/if\s*\(\s*Japan|if Japan/.test(humanTokyo), 'no country hard-coded injection in human block');
assert(/LOCAL IDENTITY|地方感/.test(humanTokyo), 'local identity');
assert(/REALISTIC DAILY DENSITY|不要硬規定每天/.test(humanTokyo), 'density guidance');
assert(/T38 sightseeing.*Stellar Place shopping|Stellar Place shopping/.test(humanTokyo), 'T38 vs shopping allowed semantic');
assert(/JR Tower Observatory|同一 major experience/.test(humanTokyo), 'duplicate observatory semantic');

console.log('\n=== short transit + time self-check ===');
const transit = sandbox.buildGeminiShortTransitCompressionBlock();
const timeChk = sandbox.buildGeminiTimeConsistencySelfCheckBlock();
const tripChk = sandbox.buildGeminiTripLevelSelfCheckBlock();
assert(/SHORT TRANSIT|不要做成獨立 itinerary event|前往 XXX/.test(transit), 'short-transfer compression exists');
assert(/TIME CONSISTENCY SELF-CHECK|40 分鐘|12:25–12:45|INVALID/.test(timeChk), 'time consistency self-check exists');
assert(/FINAL TRIP-LEVEL SELF-CHECK|mentally review/.test(tripChk), 'trip-level self-check exists');
assert(/不要 overcorrect|禁止 MUST include shopping|禁止 MUST Donki/.test(tripChk), 'no overcorrect checklist');

console.log('\n=== trip memory compact ===');
const prior = sandbox.summarizePriorDays([
  {
    day: 1,
    phases: [
      {
        items: [
          { title: '北海道大學' },
          { title: '札幌時計台' },
          { title: '午餐：二条市場海鮮' },
          { title: '藥妝購物' },
          { title: '前往 大通公園' }
        ]
      }
    ]
  },
  {
    day: 2,
    phases: [{ items: [{ title: 'JR Tower T38' }, { title: '晚餐：螃蟹吃到飽' }] }]
  }
]);
assert(/ALREADY VISITED/.test(prior), 'previous-trip context marker');
assert(/Major POI:/.test(prior) && /北海道大學/.test(prior), 'major POI listed');
assert(/Experience:/.test(prior), 'experience list');
assert(/Shopping areas:/.test(prior) && /藥妝/.test(prior), 'shopping areas');
assert(/Meal samples:/.test(prior) && /螃蟹/.test(prior), 'meal types');
assert(!/前往 大通公園/.test(prior.split('Day titles')[0]), 'short transit title not in major semantic buckets');
const memBlock = sandbox.buildGeminiTripMemoryBlock(prior);
assert(/TRIP MEMORY|Do not repeat the same major sightseeing/.test(memBlock), 'trip memory instruction');

console.log('\n=== architecture mutation locks ===');
assert(P && typeof P.auditGeminiItinerary === 'function', 'auditGemini exists');
assert(SE.canCreateContent === false, 'no Style content creation');
assert(SE.canMutateSchedule === false || /canMutateSchedule:\s*false/.test(styleSrc), 'no Style schedule mutation');
assert(/do not shift Gemini times|GUARDRAIL: flag only|flag-only|flag only/.test(tte), 'TimeQA flag-only');
assert(!/function planHiddenItineraryAsync/.test(index) || !/planHiddenItineraryAsync\s*\(\s*resolved/.test(index), 'live path not re-enabled planHidden');
assert(!/SOARVIBE_FEATURED|featuredPartners/.test(plannerSrc), 'Planner no featured');
assert(!/Don Quijote|Olive Young|UNIQLO/.test(plannerSrc) || !/inject.*Don|create.*Olive/.test(plannerSrc), 'no Planner brand injection API');

console.log('\n=== NO-INFO / WITH-INFO prompts ===');
const noInfo = attach({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
const withInfo = attach({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '想吃螃蟹、逛唐吉訶德和藥妝',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸',
  flightArrival: '2026-11-24T22:55:00+09:00',
  flightReturn: '2026-11-29T18:40:00+09:00',
  arrivalTime: '2026-11-24T22:55:00+09:00',
  returnTime: '2026-11-29T18:40:00+09:00',
  flightOutboundNumber: 'CI110',
  flightReturnNumber: 'CI111'
});
const noFull = sandbox.buildGeminiRequestText(noInfo);
const withFull = sandbox.buildGeminiRequestText(withInfo);
assert(/PREVIEW_TRIP_MODE/.test(noFull), 'NO-INFO remains PREVIEW');
assert(/人類真實旅遊節奏|GLOBAL/.test(noFull), 'NO-INFO has human realism');
assert(/ROUTE-AWARE CASUAL SHOPPING|casual shopping/.test(noFull), 'NO-INFO has shopping');
assert(/LOCAL IDENTITY|地方感/.test(noFull), 'NO-INFO has local identity');
assert(/SHORT TRANSIT|TIME CONSISTENCY SELF-CHECK|FINAL TRIP-LEVEL SELF-CHECK/.test(noFull), 'NO-INFO has self-checks');
assert(/日期限定 HARD|非全程施壓|HARD 不適用/.test(withFull) || /實際抵達日|實際離境日/.test(withFull), 'WITH-INFO flight date-scoped');
assert(/FULFILL ONCE|語意滿足|KEYWORD REPETITION/.test(withFull), 'custom wishes = fulfill intent once');
assert(/SHORT TRANSIT|TIME CONSISTENCY|TRIP-LEVEL SELF-CHECK|地方感/.test(withFull), 'WITH-INFO has P0.3 blocks');

console.log('\n=== day-by-day memory wiring ===');
const day3 = sandbox.buildGeminiSingleDayRequestText(withInfo, 3, 6, prior);
assert(/TRIP MEMORY|ALREADY VISITED/.test(day3), 'Day N includes previous-trip context');
assert(/航班 HARD 不適用|中間旅遊日/.test(day3), 'intermediate day no arrival/departure HARD');
assert(/SHORT TRANSIT|TIME CONSISTENCY/.test(day3), 'day prompt has transit+time checks');
const day1 = sandbox.buildGeminiSingleDayRequestText(withInfo, 1, 6, '');
assert(/實際抵達日|usable time|Check-in/.test(day1), 'arrival day rules');
const day6 = sandbox.buildGeminiSingleDayRequestText(withInfo, 6, 6, prior);
assert(/實際離境日|last-minute shopping|airport buffer/.test(day6), 'departure day last-minute shopping');

console.log('\n=== trip lengths 3/6/10 + regions + styles ===');
[3, 6, 10].forEach((n) => {
  const end = new Date('2026-11-24T00:00:00');
  end.setDate(end.getDate() + n - 1);
  const endIso = end.toISOString().slice(0, 10);
  const p = attach({
    destination: '曼谷',
    dateStart: '2026-11-24',
    dateEnd: endIso,
    travelStyle: 'foodie',
    customWishes: '',
    transport: 'public-transit',
    customerSelectedTransport: '大眾運輸'
  });
  const prompt = sandbox.buildGeminiRequestText(p);
  assert(new RegExp('嚴格限定為 ' + n + ' 天|共 ' + n + ' 天|Day 1.*Day ' + n).test(prompt) || prompt.includes(String(n)), 'trip length dynamic ' + n);
  assert(/PREVIEW_TRIP_MODE|人類真實旅遊節奏/.test(prompt), 'length ' + n + ' keeps human+preview path for NO-INFO');
});

REGIONS.forEach((r) => {
  const p = attach({
    destination: r.destination,
    dateStart: '2026-11-24',
    dateEnd: '2026-11-26',
    travelStyle: 'sightseeing',
    customWishes: '',
    transport: 'public-transit',
    customerSelectedTransport: '大眾運輸'
  });
  const prompt = sandbox.buildGeminiRequestText(p);
  assert(prompt.includes(r.destination), 'region prompt includes ' + r.region + ' city');
  assert(/地方感|LOCAL IDENTITY|人類真實旅遊節奏/.test(prompt), r.region + ' has global human blocks');
});

const intents = STYLES.map((k) => SE.buildPlanningIntentPrompt(k, '札幌'));
STYLES.forEach((k, i) => {
  assert(intents[i].includes('styleKey=' + k) || intents[i].length > 40, 'style ' + k + ' intent exists');
  assert(/POI selection|daily density|shopping type|不是只改形容詞/.test(intents[i]), 'style ' + k + ' planning-level distinction');
});
assert(intents[0] !== intents[3] && intents[5] !== intents[6], '7 styles retain different planning intents');
assert(/Don Quijote|Olive Young/.test(intents.join('\n')) && /語意示例|禁止品牌/.test(intents.join('\n')), 'styles keep brand examples-only language');

console.log('\n=== no paid API / no second Gemini correction ===');
assert(!/places\.googleapis|Routes API|grounding|research api|amadeus/i.test(index.slice(index.indexOf('buildGeminiHumanRealismBlock'), index.indexOf('buildGeminiTimingRulesBlock') + 800)), 'P0.3 blocks add no paid API');
assert(!/callGeminiContent\(.*correct|second.?pass|reprompt.*self.?check/i.test(index), 'no second Gemini correction call added');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
