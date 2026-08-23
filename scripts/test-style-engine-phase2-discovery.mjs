/**
 * Global Style Engine v1 Phase 2 — Destination Discovery Foundation (offline / mock).
 * node scripts/test-style-engine-phase2-discovery.mjs
 */
import fs from 'fs';
import path from 'path';
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
const DI = globalThis.SOARVIBE_DESTINATION_INTELLIGENCE;
const styleSrc = fs.readFileSync(path.join(root, 'itinerary-style-engine.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const UI_KEYS = ['budget', 'sightseeing', 'trendy', 'foodie', 'photospot', 'anime', 'streetwear'];
const UNKNOWN_DESTS = ['仙台', '里斯本', '墨爾本', '布拉格', '清邁'];

/** Shared synthetic pool — same candidates, different style rankings (anti-generic). */
function buildSyntheticPool(dest) {
  return [
    SE.createCandidate({
      id: 'core1',
      title: 'City Iconic Tower',
      destinationKey: dest,
      categories: ['iconic_landmark', 'must_see'],
      landmarkClass: 'core',
      experienceType: 'landmark',
      priceBand: 'mid'
    }),
    SE.createCandidate({
      id: 'core2',
      title: 'Old Town Square',
      destinationKey: dest,
      categories: ['iconic_landmark', 'must_see'],
      landmarkClass: 'core',
      experienceType: 'landmark',
      priceBand: 'low'
    }),
    SE.createCandidate({
      id: 'museum1',
      title: 'National Museum',
      destinationKey: dest,
      categories: ['museum', 'culture'],
      landmarkClass: 'secondary',
      experienceType: 'museum',
      priceBand: 'mid'
    }),
    SE.createCandidate({
      id: 'modern1',
      title: 'Design District Walk',
      destinationKey: dest,
      categories: ['modern_district', 'design_district'],
      experienceType: 'walk',
      neighborhoodHint: 'New Quay',
      priceBand: 'mid-high',
      tags: ['modern']
    }),
    SE.createCandidate({
      id: 'cafe1',
      title: 'Concept Cafe',
      destinationKey: dest,
      categories: ['contemporary_cafe', 'cafe'],
      experienceType: 'food',
      foodFamily: 'cafe',
      priceBand: 'mid-high',
      tags: ['modern']
    }),
    SE.createCandidate({
      id: 'market1',
      title: 'Central Market Hall',
      destinationKey: dest,
      categories: ['market', 'specialty_food'],
      experienceType: 'food',
      foodFamily: 'market',
      priceBand: 'low',
      localAuthenticity: 0.9
    }),
    SE.createCandidate({
      id: 'food1',
      title: 'Regional Specialty Shop',
      destinationKey: dest,
      categories: ['specialty_food', 'regional_dish'],
      experienceType: 'food',
      foodFamily: 'specialty_food',
      priceBand: 'mid',
      localAuthenticity: 0.85
    }),
    SE.createCandidate({
      id: 'photo1',
      title: 'Glass Pavilion Viewpoint',
      destinationKey: dest,
      categories: ['visual_landmark', 'architecture', 'viewpoint'],
      experienceType: 'landmark',
      landmarkClass: 'secondary',
      visualValue: 0.95,
      priceBand: 'mid'
    }),
    SE.createCandidate({
      id: 'anime1',
      title: 'Hobby & Figure Street',
      destinationKey: dest,
      categories: ['anime_retail', 'figure_shop', 'hobby'],
      experienceType: 'shopping',
      subcultureRelevance: 1,
      shoppingRelevance: 0.95,
      priceBand: 'low-mid'
    }),
    SE.createCandidate({
      id: 'street1',
      title: 'Vintage & Sneaker Alley',
      destinationKey: dest,
      categories: ['vintage', 'sneakers', 'streetwear', 'select_shop'],
      experienceType: 'shopping',
      subcultureRelevance: 0.9,
      shoppingRelevance: 1,
      priceBand: 'mid'
    }),
    SE.createCandidate({
      id: 'budget1',
      title: 'Free Riverside Park',
      destinationKey: dest,
      categories: ['free_landmark', 'park'],
      experienceType: 'nature',
      landmarkClass: 'secondary',
      priceBand: 'low'
    }),
    SE.createCandidate({
      id: 'budget2',
      title: 'Station Drugstore Row',
      destinationKey: dest,
      categories: ['drugstore', 'value_retail', 'shopping_street'],
      experienceType: 'shopping',
      shoppingRelevance: 0.7,
      priceBand: 'low'
    }),
    SE.createCandidate({
      id: 'mix1',
      title: 'Mixed-Use Lifestyle Mall',
      destinationKey: dest,
      categories: ['mixed_use', 'concept_store', 'lifestyle'],
      experienceType: 'shopping',
      shoppingRelevance: 0.75,
      priceBand: 'mid-high',
      tags: ['modern']
    })
  ];
}

function topIds(result, n) {
  return (result.ranked || []).slice(0, n).map((r) => r.candidate.id);
}

function bucketTitles(rows) {
  return (rows || []).map((r) => r.candidate.id);
}

console.log('\n=== A. 7 styles share Discovery pipeline ===');
assert(typeof SE.discoverDestinationCandidates === 'function', 'discoverDestinationCandidates exported');
assert(typeof SE.estimateDiscoveryCandidateBudget === 'function', 'budget helper exported');
assert(typeof SE.buildDiscoveryIntentPrompt === 'function', 'discovery intent prompt exported');
assert(typeof SE.buildShortlistBuckets === 'function', 'shortlist buckets exported');
UI_KEYS.forEach((k) => {
  const r = SE.discoverDestinationCandidates('測試城', k, {
    tripDays: 5,
    seedCandidates: buildSyntheticPool('測試城'),
    disableArchetypes: true
  });
  assert(r && r.styleKey === k && Array.isArray(r.candidates) && r.shortlist, 'pipeline runs for ' + k);
  assert(r.schedulesDays === null, k + ' does not schedule days');
  assert(r.placesCalled === false && r.groundingCalled === false, k + ' no Places/Grounding');
});

console.log('\n=== B. No per-city required DB ===');
assert(!/TOKYO_POI|SAPPORO_POI|SEOUL_POI|perCityStyle|CITY_STYLE_DB/.test(styleSrc), 'no per-city style DB patterns');
assert(!styleSrc.includes('Tokyo POI list'), 'no Tokyo POI list comment/impl');

console.log('\n=== C. Unknown destinations complete mock discovery → shortlist ===');
UNKNOWN_DESTS.forEach((dest) => {
  const r = SE.discoverDestinationCandidates(dest, 'sightseeing', {
    tripDays: 4,
    skipCuratedBoost: true,
    maxArchetypesPerDistrict: 2
  });
  assert(r.destinationKey === dest, dest + ' destinationKey');
  assert(Array.isArray(r.districts) && r.districts.length >= 1, dest + ' has districts');
  assert(Array.isArray(r.candidates) && r.candidates.length >= 1, dest + ' has candidates');
  assert(r.shortlist && r.shortlist.districts && r.shortlist.coreLandmarks, dest + ' shortlist buckets');
  assert(r.curatedEnhancementUsed !== true, dest + ' curated not required');
  // All candidates use Phase 1 contract
  assert(
    r.candidates.every((c) => c && 'discoverySource' in c && 'openStatus' in c && Array.isArray(c.categories)),
    dest + ' candidates use createCandidate fields'
  );
});

console.log('\n=== D–K. Same synthetic pool → style shortlist differs ===');
const poolDest = 'Syntheticville';
const byStyle = {};
UI_KEYS.forEach((k) => {
  byStyle[k] = SE.discoverDestinationCandidates(poolDest, k, {
    tripDays: 6,
    seedCandidates: buildSyntheticPool(poolDest),
    disableArchetypes: true
  });
});

const topSets = UI_KEYS.map((k) => topIds(byStyle[k], 5).join('|'));
const uniqueTop = new Set(topSets);
assert(uniqueTop.size >= 5, 'D at least 5 distinct top-5 rankings across 7 styles (got ' + uniqueTop.size + ')');

const sightCoreShare =
  byStyle.sightseeing.mix.core.length /
  Math.max(1, byStyle.sightseeing.candidates.length);
const trendyCoreShare =
  byStyle.trendy.mix.core.length / Math.max(1, byStyle.trendy.candidates.length);
assert(sightCoreShare >= trendyCoreShare - 0.02, 'E sightseeing core share >= trendy (soft)');
assert(
  byStyle.sightseeing.shortlist.coreLandmarks.length >=
    byStyle.anime.shortlist.coreLandmarks.length - 1,
  'E sightseeing core bucket not thinner than anime'
);

const trendyTop = topIds(byStyle.trendy, 6);
assert(
  trendyTop.includes('modern1') || trendyTop.includes('cafe1') || trendyTop.includes('mix1'),
  'F trendy elevates contemporary/modern (not pure Top10 cores only)'
);
assert(
  !(trendyTop[0] === 'core1' && trendyTop[1] === 'core2' && trendyTop[2] === 'museum1'),
  'F trendy top3 is not pure classic tourist stack'
);

const foodTop = topIds(byStyle.foodie, 5);
assert(foodTop.includes('market1') || foodTop.includes('food1'), 'G foodie food ranking high');
assert(
  byStyle.foodie.shortlist.food.length >= byStyle.sightseeing.shortlist.food.length,
  'G foodie food bucket >= sightseeing'
);

const animeTop = topIds(byStyle.anime, 5);
assert(animeTop.includes('anime1'), 'H anime subculture ranking high');

const streetTop = topIds(byStyle.streetwear, 5);
assert(streetTop.includes('street1'), 'I streetwear fashion ranking high');

const budgetTop = topIds(byStyle.budget, 5);
assert(
  budgetTop.includes('budget1') || budgetTop.includes('budget2') || budgetTop.includes('market1'),
  'J budget affordable/free ranking high'
);

const photoTop = topIds(byStyle.photospot, 5);
assert(photoTop.includes('photo1'), 'K photospot visual ranking high');

console.log('\n=== L. Trendy freshness not high (model knowledge) ===');
const trendyDisc = SE.discoverDestinationCandidates('里斯本', 'trendy', {
  tripDays: 5,
  skipCuratedBoost: true
});
assert(trendyDisc.freshnessConfidence !== 'high', 'L freshnessConfidence != high');
assert(
  trendyDisc.freshnessConfidence === 'low' || trendyDisc.freshnessConfidence === 'unknown',
  'L freshness low/unknown'
);
assert(/model_knowledge/.test(trendyDisc.sourceMode), 'L sourceMode includes model_knowledge');
assert(
  !/(現在爆紅|current hottest|recently viral|這是最新|目前最熱)/i.test(trendyDisc.intentPrompt),
  'L intent prompt does not claim live viral'
);
assert(
  /Contemporary|Trend-oriented|freshnessConfidence=unknown/i.test(trendyDisc.intentPrompt),
  'L contemporary positioning in prompt'
);

console.log('\n=== M. Curated missing does not fail ===');
UNKNOWN_DESTS.forEach((dest) => {
  const r = SE.discoverDestinationCandidates(dest, 'foodie', {
    tripDays: 3,
    skipCuratedBoost: true
  });
  assert(!!r && r.candidates.length > 0, 'M ' + dest + ' discovery succeeds without curated');
});

console.log('\n=== N. Low supply: graceful degradation, no hallucinated named POIs ===');
const thin = SE.discoverDestinationCandidates('TinyHamlet', 'trendy', {
  tripDays: 6,
  seedCandidates: [
    SE.createCandidate({
      id: 'only1',
      title: 'Hamlet Square',
      destinationKey: 'TinyHamlet',
      categories: ['iconic_landmark'],
      landmarkClass: 'core',
      experienceType: 'landmark'
    })
  ],
  disableArchetypes: true
});
assert(thin.discoveryConfidence === 'low' || (thin.warnings || []).includes('low_candidate_supply'), 'N low confidence/warning');
assert(
  thin.candidates.every((c) => !/虛構店|FakeViral|Hallucinated/.test(c.title)),
  'N no hallucinated venue filler titles'
);
assert(thin.candidates.length <= 8, 'N does not invent a large fake pool when archetypes disabled');

const withArch = SE.discoverDestinationCandidates('TinyHamlet', 'trendy', {
  tripDays: 6,
  seedCandidates: [
    SE.createCandidate({
      id: 'only1',
      title: 'Hamlet Square',
      destinationKey: 'TinyHamlet',
      categories: ['iconic_landmark'],
      landmarkClass: 'core',
      experienceType: 'landmark'
    })
  ],
  maxArchetypesPerDistrict: 2
});
assert(
  withArch.candidates.every(
    (c) =>
      c.discoverySource === 'seed' ||
      c.discoverySource === 'style_archetype' ||
      c.discoverySource === 'intel_anchor' ||
      c.discoverySource === 'curated_optional'
  ),
  'N only seed/archetype/intel sources'
);
assert(
  withArch.candidates
    .filter((c) => c.discoverySource === 'style_archetype')
    .every((c) => /風格意圖槽位/.test(c.title)),
  'N archetypes are intent slots, not fake shop names'
);

console.log('\n=== StyleDefinition influences discovery prompt ===');
const discPrompt = SE.buildDiscoveryIntentPrompt('布拉格', 'streetwear', { tripDays: 4 });
assert(/選點意圖|prioritize|優先類別/.test(discPrompt), 'prompt carries selection intent');
assert(/vintage|streetwear|sneakers|古著|球鞋|買手/i.test(discPrompt), 'streetwear cats in prompt');
assert(/STYLE ≠ PACE|禁止輸出完整行程/.test(discPrompt), 'discovery-only / no schedule');

console.log('\n=== Adaptive soft budget ===');
const b3 = SE.estimateDiscoveryCandidateBudget({ tripDays: 3, styleKey: 'sightseeing' });
const b6 = SE.estimateDiscoveryCandidateBudget({ tripDays: 6, styleKey: 'sightseeing' });
assert(b6.softTarget >= b3.softTarget, 'longer trip softTarget >= shorter');
assert(b6.softMax === 40 && b6.softMin < b6.softTarget, 'soft range not hard quota of 40');

console.log('\n=== Debug surface ===');
assert(globalThis.__SOARVIBE_DISCOVERY_DEBUG__ && globalThis.__SOARVIBE_DISCOVERY_DEBUG__.last, 'debug last run present');
assert(
  !JSON.stringify(globalThis.__SOARVIBE_DISCOVERY_DEBUG__.last).includes('AIza'),
  'debug has no API key'
);

console.log('\n=== Phase 2 discovery is wired for Phase 3 (trip-level) ===');
assert(/ensurePayloadDiscovery|ensureTripDiscovery/.test(index), 'index wires discovery');
assert(/buildGeminiCandidateBoundBlock/.test(index), 'index has candidate-bound block');
assert(SE.PHASE3_CANDIDATE_BOUND_ENTRY && /fetchGeminiItineraryDayByDay/.test(SE.PHASE3_CANDIDATE_BOUND_ENTRY), 'Phase3 hook documented');

console.log('\n=== DI optional / unknown path ===');
assert(DI && typeof DI.buildDestinationIntelligence === 'function', 'DI reusable');
const sendaiIntel = DI.buildDestinationIntelligence('仙台', { travelStyle: 'sightseeing', tripDays: 3 }, {});
assert(sendaiIntel && Array.isArray(sendaiIntel.districts), 'DI works for 仙台');
assert(!sendaiIntel.curatedEnhancement || sendaiIntel.unknownDestination !== false, '仙台 not requiring curated');

console.log('\n=== O–Q regressions (spawn) ===');
function runNode(script) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    encoding: 'utf8',
    cwd: root
  });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, out };
}

const p1 = runNode('test-style-engine-phase1.mjs');
assert(p1.code === 0, 'O Phase1 tests pass');
if (p1.code !== 0) console.error(p1.out.slice(-800));

const mid = runNode('test-day-completeness-middle-flight.mjs');
assert(mid.code === 0, 'P middle ZERO flight / completeness tests pass');
if (mid.code !== 0) console.error(mid.out.slice(-800));

const p02 = runNode('test-p0-2-with-info.mjs');
assert(p02.code === 0, 'Q related flight softFacts / p0-2 tests pass');
if (p02.code !== 0) console.error(p02.out.slice(-800));

console.log('\n========== Phase 2 Discovery summary ==========');
console.log('passed=' + passed + ' failed=' + failed);
process.exit(failed ? 1 : 0);
