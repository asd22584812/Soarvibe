/**
 * Global Style Engine v1 Phase 3 — Candidate-bound Itinerary (offline / mock).
 * node scripts/test-style-engine-phase3-candidate-bound.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
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

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(path.join(root, 'travel-time-engine.js'));
require(path.join(root, 'itinerary-destination-intelligence.js'));
require(path.join(root, 'itinerary-style-engine.js'));
require(path.join(root, 'itinerary-planner-v2.js'));

const SE = globalThis.SOARVIBE_STYLE_ENGINE;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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
  buildGeminiHumanRealismBlock: "function buildGeminiHumanRealismBlock() { return ''; }",
  buildGeminiShortTransitCompressionBlock: "function buildGeminiShortTransitCompressionBlock() { return ''; }",
  buildGeminiTimeConsistencySelfCheckBlock: "function buildGeminiTimeConsistencySelfCheckBlock() { return ''; }",
  buildGeminiTripLevelSelfCheckBlock: "function buildGeminiTripLevelSelfCheckBlock() { return ''; }",
  buildGeminiTripMemoryBlock:
    "function buildGeminiTripMemoryBlock(priorSummary) { return priorSummary ? ('【TRIP MEMORY】 ' + priorSummary) : ''; }",
  buildGeminiDayCompletenessBlock:
    "function buildGeminiDayCompletenessBlock() { return '【DAY COMPLETENESS CONTRACT】正常全日須填滿；STYLE≠PACE；避免 60–90 分 gaps；禁止 2–3 卡稀疏；午餐／晚餐；7 大風格 Style-aware。'; }",
  buildGeminiTransportInstructionBlock:
    "function buildGeminiTransportInstructionBlock(mode, label) { var m = String(mode || ''); if (m === 'public-transit' || m === 'transit') return '【USER HARD】交通 100% 遵守：大眾運輸'; if (m === 'self-drive') return '【USER HARD】交通 100% 遵守：自駕'; return '【交通未選擇（禁止生成）】必須由使用者明確選擇'; }",
  buildTransportModeLine: "function buildTransportModeLine(label) { return 'metro ' + (label || ''); }"
};

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
  'buildGeminiMultiDayRequestText',
  'buildGeminiDayCompletenessReplanPrompt'
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

const E = globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;
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

function seedPool(dest) {
  return [
    SE.createCandidate({
      id: 'core1',
      title: 'Clock Tower Landmark',
      destinationKey: dest,
      categories: ['iconic_landmark', 'must_see'],
      landmarkClass: 'core',
      experienceType: 'landmark',
      neighborhoodHint: dest + '中心',
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'core2',
      title: 'Old Castle',
      destinationKey: dest,
      categories: ['iconic_landmark'],
      landmarkClass: 'core',
      experienceType: 'landmark',
      neighborhoodHint: dest + '中心',
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'modern1',
      title: 'Design Hub Cafe Street',
      destinationKey: dest,
      categories: ['modern_district', 'contemporary_cafe'],
      experienceType: 'walk',
      neighborhoodHint: dest + '北側',
      tags: ['modern'],
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'market1',
      title: 'Central Market Hall',
      destinationKey: dest,
      categories: ['market', 'specialty_food'],
      experienceType: 'food',
      foodFamily: 'market',
      neighborhoodHint: dest + '中心',
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'anime1',
      title: 'Hobby Figure Street',
      destinationKey: dest,
      categories: ['anime_retail', 'figure_shop'],
      experienceType: 'shopping',
      subcultureRelevance: 1,
      shoppingRelevance: 0.95,
      neighborhoodHint: dest + '東側',
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'street1',
      title: 'Vintage Sneaker Alley',
      destinationKey: dest,
      categories: ['vintage', 'sneakers', 'streetwear'],
      experienceType: 'shopping',
      shoppingRelevance: 1,
      neighborhoodHint: dest + '西側',
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'photo1',
      title: 'Glass Pavilion',
      destinationKey: dest,
      categories: ['visual_landmark', 'architecture'],
      experienceType: 'landmark',
      visualValue: 0.95,
      neighborhoodHint: dest + '南側',
      candidateKind: 'real'
    }),
    SE.createCandidate({
      id: 'arch1',
      title: dest + '中心｜當代咖啡（風格意圖槽位）',
      destinationKey: dest,
      categories: ['contemporary_cafe'],
      discoverySource: 'style_archetype',
      candidateKind: 'archetype',
      neighborhoodHint: dest + '中心',
      experienceType: 'food',
      foodFamily: 'cafe'
    })
  ];
}

console.log('\n=== A. Trip discovery once, shared across days ===');
SE.clearTripDiscoveryCache();
const payload6 = attach({
  destination: '里斯本',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'trendy',
  customWishes: '',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
const d1 = SE.ensureTripDiscovery(payload6, { seedCandidates: seedPool('里斯本'), disableArchetypes: true });
const d2 = SE.ensureTripDiscovery(payload6);
assert(d1 === d2 || d2.__fromCache === true, 'A second ensure hits cache');
assert(payload6.__soarvibeDiscovery, 'A discovery attached to payload');
const key1 = SE.tripDiscoveryCacheKey(payload6);
assert(!!key1 && key1.indexOf('里斯本') !== -1, 'A cache key includes destination');

console.log('\n=== B. Day prompt receives shortlist ===');
const day3 = sandbox.buildGeminiSingleDayRequestText(payload6, 3, 6, '');
assert(/CANDIDATE-BOUND|CORE LANDMARKS|STYLE-SPECIFIC|FOOD/.test(day3), 'B day prompt has candidate-bound sections');
assert(/APPROVED|ANCHOR|SEMANTIC SLOT/.test(day3), 'B day prompt has kind markers');
const full = sandbox.buildGeminiRequestText(payload6);
assert(/CANDIDATE-BOUND/.test(full), 'B full-trip prompt has candidate-bound');

console.log('\n=== C–D. Middle ZERO flight / edge HARD ===');
const withFlight = attach({
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
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
SE.clearTripDiscoveryCache();
const mid = sandbox.buildGeminiSingleDayRequestText(withFlight, 3, 6, '');
const arr = sandbox.buildGeminiSingleDayRequestText(withFlight, 1, 6, '');
const dep = sandbox.buildGeminiSingleDayRequestText(withFlight, 6, 6, '');
assert(/中間旅遊日|NORMAL USABLE FULL DAY|中間日/.test(mid), 'C middle day travel planning');
assert(/CANDIDATE-BOUND|APPROVED|shortlist/i.test(mid), 'C middle candidate-bound present');
assert(/抵達日 HARD|USER HARD FLIGHT|抵達時間/.test(arr), 'D arrival HARD');
assert(/離境日 HARD|USER HARD FLIGHT|送機/.test(dep), 'D departure HARD');

console.log('\n=== E–F. Usage QA ===');
SE.clearTripDiscoveryCache();
const disc = SE.ensureTripDiscovery(withFlight, {
  seedCandidates: seedPool('札幌'),
  disableArchetypes: true,
  forceRefresh: true
});
const slice = SE.selectDayCandidateSlice(disc, 3, 6);
assert((slice.approvedCandidates || []).length >= 4, 'E approved pool size (' + (slice.approvedCandidates || []).length + ')');
const goodDay = {
  day: 3,
  phases: [
    {
      period: '上午',
      items: [
        { time: '09:00 - 10:30', title: 'Clock Tower Landmark', note: 'x' },
        { time: '10:45 - 12:00', title: 'Old Castle', note: 'x' }
      ]
    },
    {
      period: '下午',
      items: [
        { time: '12:30 - 13:30', title: 'Central Market Hall', note: 'x' },
        { time: '14:00 - 16:00', title: 'Glass Pavilion', note: 'x' }
      ]
    },
    {
      period: '晚上',
      items: [{ time: '18:00 - 19:30', title: 'Design Hub Cafe Street', note: 'x' }]
    }
  ]
};
const goodQa = SE.evaluateCandidateUsageQa(goodDay, slice);
assert(goodQa.candidateUsageRatio >= 0.6, 'E good day uses approved (ratio=' + goodQa.candidateUsageRatio + ')');
assert(!goodQa.candidate_bound_violation, 'E no violation when using shortlist');

const genericDay = {
  day: 3,
  phases: [
    {
      period: '上午',
      items: [
        { time: '09:00 - 10:00', title: '東京晴空塔', note: 'x' },
        { time: '10:30 - 12:00', title: '淺草寺', note: 'x' }
      ]
    },
    {
      period: '下午',
      items: [
        { time: '13:00 - 14:00', title: '一蘭拉麵', note: 'x' },
        { time: '15:00 - 17:00', title: '明治神宮', note: 'x' }
      ]
    },
    {
      period: '晚上',
      items: [{ time: '18:00 - 20:00', title: '澀谷十字路口', note: 'x' }]
    }
  ]
};
const badQa = SE.evaluateCandidateUsageQa(genericDay, Object.assign({}, slice, { shortlistSufficient: true }));
assert(badQa.candidate_bound_violation, 'F generic unrelated POI → candidate_bound_violation');

console.log('\n=== G. Archetype not shown as real POI in prompt / UI sanitize ===');
const archPrompt = SE.buildCandidateBoundDayPrompt(disc, { dayNum: 2, totalDays: 6 });
assert(/SEMANTIC SLOT｜非店名/.test(archPrompt) || !/風格意圖槽位/.test(archPrompt) || /禁止把此槽位/.test(archPrompt), 'G archetype framed as semantic slot');
const leakDay = {
  days: [
    {
      phases: [
        {
          items: [{ title: '札幌中心｜當代咖啡（風格意圖槽位）', highlight: 'x', note: 'x' }]
        }
      ]
    }
  ]
};
SE.sanitizeItineraryForRender(leakDay);
assert(!/風格意圖槽位/.test(leakDay.days[0].phases[0].items[0].title), 'G sanitize strips 風格意圖槽位 from UI title');

console.log('\n=== H. Trendy freshness wording ===');
SE.clearTripDiscoveryCache();
const trendyP = attach({
  destination: '墨爾本',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'trendy',
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
const trendyDay = sandbox.buildGeminiSingleDayRequestText(trendyP, 3, 6, '');
assert(/Contemporary|Trend-oriented|freshness/i.test(trendyDay), 'H trendy contemporary framing');
assert(!/current hottest|recently viral|現在爆紅/.test(trendyDay) || /禁止/.test(trendyDay), 'H no live viral claim (or only as ban)');

console.log('\n=== I–K. Style mix / food differences ===');
function discFor(style) {
  SE.clearTripDiscoveryCache();
  return SE.discoverDestinationCandidates('SyntheticCity', style, {
    tripDays: 6,
    seedCandidates: seedPool('SyntheticCity'),
    disableArchetypes: true
  });
}
const sight = discFor('sightseeing');
const anime = discFor('anime');
const street = discFor('streetwear');
const foodie = discFor('foodie');
const trendy = discFor('trendy');
assert(
  sight.mix.coreShareSoft >= trendy.mix.coreShareSoft - 0.01,
  'I sightseeing core soft share >= trendy'
);
assert(anime.ranked[0].candidate.id === 'anime1', 'J anime top not pure Top10 landmark');
assert(street.ranked[0].candidate.id === 'street1', 'J streetwear top fashion');
assert(foodie.ranked[0].candidate.id === 'market1' || foodie.shortlist.food.length >= 1, 'K foodie food bound');
const foodiePrompt = SE.buildCandidateBoundDayPrompt(foodie, { dayNum: 2, totalDays: 6 });
const animePrompt = SE.buildCandidateBoundDayPrompt(anime, { dayNum: 2, totalDays: 6 });
assert(/Central Market|market|美食|FOOD/i.test(foodiePrompt), 'K foodie food section present');
assert(/Hobby|anime|figure|STYLE-SPECIFIC/i.test(animePrompt), 'K anime style-specific differs');

console.log('\n=== L. Shortlist thin → provisional fallback wording ===');
SE.clearTripDiscoveryCache();
const thin = SE.discoverDestinationCandidates('TinyPlace', 'trendy', {
  tripDays: 6,
  seedCandidates: [
    SE.createCandidate({
      id: 'only',
      title: 'Only Square',
      destinationKey: 'TinyPlace',
      categories: ['iconic_landmark'],
      landmarkClass: 'core',
      candidateKind: 'real'
    })
  ],
  disableArchetypes: true
});
const thinPrompt = SE.buildCandidateBoundDayPrompt(thin, { dayNum: 2, totalDays: 6 });
assert(/FALLBACK|provisional|偏少|shortlist/i.test(thinPrompt), 'L graceful provisional fallback');

console.log('\n=== M–N. Replan still candidate-bound; max 1 replan wired ===');
assert(/maybeReplanDayForCompleteness/.test(index), 'M replan wired');
assert(/Max 1 replan|at most ONE|最多 1/i.test(index) || /replan once/i.test(index), 'M max one replan language');
const replanPrompt = sandbox.buildGeminiDayCompletenessReplanPrompt(
  payload6,
  3,
  6,
  '',
  goodDay,
  { meaningfulItemCount: 2, issues: [{ type: 'too_sparse', message: 'sparse' }] }
);
assert(/CANDIDATE-BOUND/.test(replanPrompt), 'N replan prompt candidate-bound');
assert(/禁止完全無視 shortlist/.test(replanPrompt), 'N replan forbids free invent');

console.log('\n=== Index wiring ===');
assert(/ensurePayloadDiscovery\(payload\)/.test(index), 'fetch path ensures discovery');
assert(/clearTripDiscoveryCache/.test(index), 'trip cache cleared per generation');
assert(/annotateCandidateBoundDayQa/.test(index), 'usage QA annotated');
assert(!/google.*grounding|Places\.search|Web Search API/i.test(index.match(/buildGeminiCandidateBoundBlock[\s\S]{0,800}/)?.[0] || ''), 'no grounding in bound block');

console.log('\n=== O–P regressions ===');
function runNode(script) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    encoding: 'utf8',
    cwd: root
  });
}
const p1 = runNode('test-style-engine-phase1.mjs');
assert(p1.status === 0, 'O Phase1 pass');
if (p1.status !== 0) console.error((p1.stdout + p1.stderr).slice(-600));
const p2 = runNode('test-style-engine-phase2-discovery.mjs');
assert(p2.status === 0, 'O Phase2 pass');
if (p2.status !== 0) console.error((p2.stdout + p2.stderr).slice(-600));
const midT = runNode('test-day-completeness-middle-flight.mjs');
assert(midT.status === 0, 'P middle-flight / completeness pass');
if (midT.status !== 0) console.error((midT.stdout + midT.stderr).slice(-800));
const p02 = runNode('test-p0-2-with-info.mjs');
assert(p02.status === 0, 'P p0-2 pass');
if (p02.status !== 0) console.error((p02.stdout + p02.stderr).slice(-800));

console.log('\n========== Phase 3 Candidate-bound summary ==========');
console.log('passed=' + passed + ' failed=' + failed);
process.exit(failed ? 1 : 0);
