/**
 * GLOBAL GENERATION WIRING RESTORE checks.
 * node scripts/test-generation-wiring-restore.mjs
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
const P = globalThis.SOARVIBE_PLANNER_V2;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFn(src, name) {
  let start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
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
  throw new Error('unclosed ' + name);
}

console.log('\n=== A. unique POI breakfast+explore ===');
const samePoiDay = {
  day: 2,
  phases: [
    {
      period: '上午',
      items: [{ time: '09:00 - 09:45', title: '早餐：大通市場', highlight: 'x', note: 'y' }]
    },
    {
      period: '下午',
      items: [{ time: '10:00 - 11:30', title: '探索大通市場', highlight: 'x', note: 'y' }]
    },
    {
      period: '晚上',
      items: [{ time: '18:00 - 19:30', title: '晚餐：在地晚餐或夜景', highlight: 'x', note: 'y' }]
    }
  ]
};
const qaA = P.evaluateDayCompletenessQa(samePoiDay, {
  planningRole: 'middle',
  payload: { travelStyle: 'sightseeing', customWishes: '' }
});
assert(
  (qaA.uniqueMeaningfulItemCount || qaA.meaningfulItemCount) === 1,
  'A uniqueMeaningfulItemCount === 1 (got ' +
    (qaA.uniqueMeaningfulItemCount || qaA.meaningfulItemCount) +
    ', raw=' +
    qaA.rawMeaningfulItemCount +
    ')'
);

console.log('\n=== B. middle day 3h gap + unique<=4 → severe ===');
const gapDay = {
  day: 3,
  phases: [
    {
      period: '上午',
      items: [
        { time: '09:00 - 10:00', title: '早餐：Cafe A', highlight: 'x', note: 'y' },
        { time: '10:15 - 11:30', title: '景點 B', highlight: 'x', note: 'y' }
      ]
    },
    {
      period: '下午',
      items: [{ time: '14:45 - 16:00', title: '景點 C', highlight: 'x', note: '徒歩' }]
    },
    {
      period: '晚上',
      items: [{ time: '18:00 - 19:30', title: '晚餐：Restaurant D', highlight: 'x', note: 'y' }]
    }
  ]
};
const qaB = P.evaluateDayCompletenessQa(gapDay, {
  planningRole: 'middle',
  payload: { travelStyle: 'sightseeing', customWishes: '' }
});
assert(qaB.severe === true, 'B severe=true');
assert(
  (qaB.uniqueMeaningfulItemCount || qaB.meaningfulItemCount) <= 4,
  'B unique<=4 (' + (qaB.uniqueMeaningfulItemCount || qaB.meaningfulItemCount) + ')'
);
assert((qaB.longGaps || []).length >= 1, 'B has long gap');

console.log('\n=== C. foodie instruction no Tabelog/Michelin/seafood bias ===');
const foodieFn = extractFn(index, 'buildGeminiStyleInstruction');
const foodieMatch = foodieFn.match(/foodie:\s*'[\s\S]*?(?=,\s*photospot:)/);
assert(!!foodieMatch, 'C foodie branch found');
const foodieText = foodieMatch ? foodieMatch[0] : '';
assert(!/Tabelog/i.test(foodieText), 'C no Tabelog');
assert(!/Michelin|米其林必比登/i.test(foodieText), 'C no Michelin/必比登');
assert(!/過度|必須排在著名美食街、海鮮市場/.test(foodieText), 'C no heavy seafood-market bias string');
assert(/depachika|food hall|區域名物|STYLE\s*≠\s*PACE|STYLE != PACE/i.test(foodieText), 'C global diverse foodie intent');

console.log('\n=== D. single-day prompt contains candidate-bound markers ===');
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
const required = [
  'buildFlightLegSummary',
  'formatFlightDateTime',
  'buildFlightPromptDetails',
  'isoDateOnly',
  'tripDayDateIso',
  'classifyFlightDayRole',
  'hasHardFlightData',
  'classifyPlanningDayRole',
  'buildGeminiPlannerPersonaBlock',
  'buildGeminiTimingRulesBlock',
  'buildGeminiStyleInstruction',
  'ensurePayloadDiscovery',
  'buildGeminiCandidateBoundBlock',
  'annotateCandidateBoundDayQa',
  'buildGeminiKoreaNameBlock',
  'buildGeminiJsonOutputBlock',
  'buildGeminiStyleBlocks',
  'buildGeminiFlightLogicBlock',
  'buildGeminiRequestText',
  'buildGeminiSingleDayRequestText',
  'buildGeminiMultiDayRequestText',
  'buildGeminiDayCompletenessReplanPrompt',
  'wantsSparseLeisureItinerary'
];
let code = '"use strict";\n';
required.forEach((n) => {
  code += extractFn(index, n) + '\n';
});
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const E = globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;
const payload = E.attachToPayload({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
const single = sandbox.buildGeminiSingleDayRequestText(payload, 3, 6, '');
assert(
  /CANDIDATE-BOUND|APPROVED|shortlist/i.test(single),
  'D single-day has candidate-bound markers'
);

console.log('\n=== E. replan prompt includes candidate-bound / discovery path ===');
const replan = sandbox.buildGeminiDayCompletenessReplanPrompt(
  payload,
  3,
  6,
  '',
  {
    day: 3,
    phases: [{ period: '上午', items: [{ time: '09:00 - 10:00', title: 'X', highlight: 'x', note: 'y' }] }]
  },
  { meaningfulItemCount: 2, issues: [{ type: 'too_sparse', message: 'sparse' }] }
);
assert(/CANDIDATE-BOUND|APPROVED|shortlist/i.test(replan), 'E replan has candidate-bound block');
assert(/ensurePayloadDiscovery/.test(index), 'E ensurePayloadDiscovery in index');
assert(/buildGeminiCandidateBoundBlock\(payload, dayNum, totalDays\)/.test(index), 'E replan calls bound block');

console.log('\n=== F. wiring symbols present ===');
assert(/function annotateCandidateBoundDayQa/.test(index), 'F annotateCandidateBoundDayQa');
assert(/evaluateCandidateUsageQa/.test(index), 'F evaluateCandidateUsageQa path');
assert(/async function maybeReplanDayForCompleteness/.test(index), 'F maybeReplanDayForCompleteness');
assert(/return await maybeReplanDayForCompleteness/.test(index), 'F single-day wired to replan');
assert(/ensurePayloadDiscovery\(payload\)/.test(index), 'F discovery in fetch path');

console.log('\n==== RESULT passed=' + passed + ' failed=' + failed + ' ====');
if (failed) process.exit(1);
