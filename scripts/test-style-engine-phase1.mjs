/**
 * Global Style Engine v1 Phase 1 — Selection Foundation (offline).
 * node scripts/test-style-engine-phase1.mjs
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
require(path.join(root, 'itinerary-style-engine.js'));
require(path.join(root, 'itinerary-planner-v2.js'));
const SE = globalThis.SOARVIBE_STYLE_ENGINE;
const P = globalThis.SOARVIBE_PLANNER_V2;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styleSrc = fs.readFileSync(path.join(root, 'itinerary-style-engine.js'), 'utf8');

const UI_KEYS = ['budget', 'sightseeing', 'trendy', 'foodie', 'photospot', 'anime', 'streetwear'];

console.log('\n=== A. Style keys match UI ===');
assert(SE && Array.isArray(SE.STYLE_KEYS), 'STYLE_KEYS exported');
assert(SE.STYLE_KEYS.join(',') === UI_KEYS.join(','), 'STYLE_KEYS order matches UI');
UI_KEYS.forEach((k) => {
  assert(index.includes('value="' + k + '"'), 'UI has radio ' + k);
});

console.log('\n=== B. Distinct StyleDefinitions ===');
const intents = new Set();
UI_KEYS.forEach((k) => {
  const d = SE.getStyleDefinition(k);
  assert(!!d && d.key === k, 'definition for ' + k);
  assert(d.selectionIntent && d.prioritizeCategories && d.prioritizeCategories.length, k + ' has selection fields');
  assert(d.foodIntent && d.neighborhoodIntent, k + ' has food/neighborhood');
  assert(d.dailyEventCount == null && d.minimumStops == null && d.styleDensityTarget == null, k + ' no density quota fields');
  intents.add(d.selectionIntent);
});
assert(intents.size === 7, '7 distinct selectionIntent strings');

console.log('\n=== C–F. STYLE ≠ PACE ===');
const trendyInst = SE.buildStyleInstructionPrompt('trendy', 'Lisbon', '新潮熱門');
const animeInst = SE.buildStyleInstructionPrompt('anime', 'Sendai', '玩具動漫');
const streetInst = SE.buildStyleInstructionPrompt('streetwear', 'Melbourne', '潮流玩家');
const foodieIntent = SE.buildPlanningIntentPrompt('foodie', 'Prague');
assert(!/單點 1[–-]1\.5\s*小時/.test(trendyInst), 'C trendy no 1–1.5h day-thinning');
assert(/STYLE ≠ PACE|DAY COMPLETENESS/.test(trendyInst), 'C trendy keeps completeness duty');
assert(!/一天最多兩個大核心區/.test(animeInst), 'D anime no day-max-2-cores density rule');
assert(/routing|動線|DAY COMPLETENESS|STYLE ≠ PACE/.test(animeInst), 'D anime routing≠completeness bypass');
assert(!/每個商圈 2[–-]3 小時/.test(streetInst), 'E streetwear no 2–3h density rule');
assert(!/densityTarget|密度目標約 4/.test(foodieIntent), 'F foodie no densityTarget=4');
assert(!Object.prototype.hasOwnProperty.call(SE.STYLE_PROFILES.foodie, 'densityTarget'), 'F profiles lack densityTarget');
assert(!Object.prototype.hasOwnProperty.call(SE.STYLE_PROFILES.anime, 'densityTarget'), 'F anime profile no densityTarget');
assert(SE.ACTIVITY_DURATION_HINTS.retail_cluster && SE.ACTIVITY_DURATION_HINTS.main_meal, 'activity duration hints exist');

console.log('\n=== G. Synthetic pool ranking differs by style ===');
const pool = [
  SE.createCandidate({
    id: 'core1',
    title: 'City Iconic Tower',
    destinationKey: 'UnknownCity',
    categories: ['iconic_landmark', 'must_see'],
    landmarkClass: 'core',
    experienceType: 'landmark',
    priceBand: 'mid',
    visualValue: 0.8
  }),
  SE.createCandidate({
    id: 'modern1',
    title: 'Design District Concept Store',
    destinationKey: 'UnknownCity',
    categories: ['design_retail', 'modern_district', 'concept_store'],
    landmarkClass: 'none',
    experienceType: 'shopping',
    priceBand: 'mid-high',
    shoppingRelevance: 0.9,
    freshnessConfidence: 'unknown'
  }),
  SE.createCandidate({
    id: 'food1',
    title: 'Central Food Market',
    destinationKey: 'UnknownCity',
    categories: ['market', 'specialty_food', 'regional_dish'],
    foodFamily: 'market',
    experienceType: 'food',
    landmarkClass: 'none',
    priceBand: 'mid',
    localAuthenticity: 0.9
  }),
  SE.createCandidate({
    id: 'anime1',
    title: 'Hobby Figure Arcade',
    destinationKey: 'UnknownCity',
    categories: ['anime_retail', 'figure_shop', 'hobby'],
    landmarkClass: 'none',
    experienceType: 'shopping',
    subcultureRelevance: 1,
    shoppingRelevance: 0.95,
    priceBand: 'low-mid'
  }),
  SE.createCandidate({
    id: 'vintage1',
    title: 'Vintage Sneaker Alley',
    destinationKey: 'UnknownCity',
    categories: ['vintage', 'sneakers', 'streetwear', 'fashion_alley'],
    landmarkClass: 'none',
    experienceType: 'shopping',
    subcultureRelevance: 0.9,
    shoppingRelevance: 1,
    priceBand: 'mid'
  }),
  SE.createCandidate({
    id: 'photo1',
    title: 'Waterfront Glass Pavilion',
    destinationKey: 'UnknownCity',
    categories: ['viewpoint', 'architecture', 'visual_landmark'],
    landmarkClass: 'secondary',
    experienceType: 'landmark',
    visualValue: 1,
    priceBand: 'mid'
  }),
  SE.createCandidate({
    id: 'free1',
    title: 'Riverside Park Walk',
    destinationKey: 'UnknownCity',
    categories: ['park', 'free_landmark'],
    landmarkClass: 'secondary',
    experienceType: 'nature',
    priceBand: 'low'
  })
];

const topByStyle = {};
UI_KEYS.forEach((k) => {
  topByStyle[k] = SE.rankCandidatesForStyle(pool, k)[0].candidate.id;
});
assert(topByStyle.sightseeing === 'core1' || topByStyle.sightseeing === 'photo1', 'G sightseeing prefers iconic/visual core');
assert(topByStyle.anime === 'anime1', 'G anime ranks hobby first');
assert(topByStyle.streetwear === 'vintage1', 'G streetwear ranks vintage first');
assert(topByStyle.foodie === 'food1', 'G foodie ranks market first');
assert(topByStyle.trendy === 'modern1', 'G trendy ranks design/modern first');
assert(topByStyle.budget === 'free1' || topByStyle.budget === 'food1' || topByStyle.budget === 'core1', 'G budget prefers free/value');
const uniqueTops = new Set(Object.values(topByStyle));
assert(uniqueTops.size >= 5, 'G at least 5 different top picks across 7 styles (' + uniqueTops.size + ')');

console.log('\n=== H. Core landmark affinity ===');
const coreOnly = pool.find((c) => c.id === 'core1');
const sightCore = SE.scoreStyleAffinity(coreOnly, 'sightseeing').score;
const animeCore = SE.scoreStyleAffinity(coreOnly, 'anime').score;
const streetCore = SE.scoreStyleAffinity(coreOnly, 'streetwear').score;
const foodieCore = SE.scoreStyleAffinity(coreOnly, 'foodie').score;
assert(sightCore > animeCore, 'H sightseeing > anime on pure core');
assert(sightCore > streetCore, 'H sightseeing > streetwear on pure core');
assert(sightCore > foodieCore, 'H sightseeing > foodie on pure core');
assert(animeCore < 0.55, 'H anime does not crown generic core (' + animeCore + ')');

console.log('\n=== I. Food candidate rankings differ ===');
const foods = [
  SE.createCandidate({
    id: 'f_budget',
    title: 'Affordable Noodle Stall',
    destinationKey: 'X',
    categories: ['budget_meal', 'market'],
    foodFamily: 'budget_meal',
    experienceType: 'food',
    priceBand: 'low'
  }),
  SE.createCandidate({
    id: 'f_sig',
    title: 'Signature Regional Dish Hall',
    destinationKey: 'X',
    categories: ['regional_dish', 'representative_food', 'specialty_food'],
    foodFamily: 'regional_dish',
    experienceType: 'food',
    priceBand: 'mid'
  }),
  SE.createCandidate({
    id: 'f_cafe',
    title: 'Contemporary Design Cafe',
    destinationKey: 'X',
    categories: ['contemporary_cafe', 'cafe'],
    foodFamily: 'cafe',
    experienceType: 'food',
    priceBand: 'mid-high',
    freshnessConfidence: 'unknown'
  }),
  SE.createCandidate({
    id: 'f_view',
    title: 'Glass View Dessert Cafe',
    destinationKey: 'X',
    categories: ['photo_cafe', 'dessert', 'visual'],
    foodFamily: 'dessert',
    experienceType: 'food',
    visualValue: 0.95,
    priceBand: 'mid-high'
  }),
  SE.createCandidate({
    id: 'f_quick',
    title: 'Arcade Quick Bites',
    destinationKey: 'X',
    categories: ['quick_eat', 'character_cafe'],
    foodFamily: 'quick_eat',
    experienceType: 'food',
    priceBand: 'low-mid'
  })
];
assert(SE.rankCandidatesForStyle(foods, 'budget')[0].candidate.id === 'f_budget', 'I budget food top');
assert(SE.rankCandidatesForStyle(foods, 'sightseeing')[0].candidate.id === 'f_sig', 'I sightseeing food top');
assert(SE.rankCandidatesForStyle(foods, 'trendy')[0].candidate.id === 'f_cafe', 'I trendy food top');
assert(SE.rankCandidatesForStyle(foods, 'foodie')[0].candidate.id === 'f_sig' || SE.rankCandidatesForStyle(foods, 'foodie')[0].candidate.id === 'f_budget', 'I foodie prefers specialty/market');
assert(SE.rankCandidatesForStyle(foods, 'photospot')[0].candidate.id === 'f_view', 'I photospot food top');
assert(SE.rankCandidatesForStyle(foods, 'anime')[0].candidate.id === 'f_quick', 'I anime food top');

console.log('\n=== J. Unknown destination — no city-specific selection code path ===');
const mix = SE.planCoreStyleMix(pool, 'trendy');
assert(mix.supplyScale === 'small' || mix.supplyScale === 'mid', 'J supply scale from count');
assert(typeof mix.coreShareSoft === 'number' && mix.coreShareSoft > 0 && mix.coreShareSoft < 0.5, 'J soft core share');
assert(!/Sapporo|Tokyo|Paris|Sendai/.test(JSON.stringify(SE.createCandidate({ destinationKey: 'Brno', title: 'X' }))), 'J candidate schema city-agnostic');
assert(!styleSrc.includes('sendaiTrendy') && !styleSrc.includes('lisbonFoodPlaces'), 'J no city style lists');

console.log('\n=== Prompt single source ===');
assert(/buildStyleInstructionPrompt/.test(index), 'index delegates style instruction');
assert(/STYLE_DEFINITION|STYLE ≠ PACE/.test(SE.buildPlanningIntentPrompt('trendy', 'Osaka')), 'planning from definition');
assert(/buildStyleInstructionPrompt/.test(styleSrc) && /STYLE_DEFINITIONS/.test(styleSrc), 'engine owns definitions');

console.log('\n=== Completeness not bypassed by style ===');
const sparse = {
  day: 3,
  phases: [
    { period: '上午', items: [{ time: '09:00 - 10:00', title: '早餐：Cafe', highlight: 'x', note: 'y' }] },
    { period: '下午', items: [{ time: '13:00 - 15:30', title: 'Design Mall', highlight: 'x', note: 'y' }] },
    { period: '晚上', items: [{ time: '18:00 - 20:30', title: 'Dinner', highlight: 'x', note: 'y' }] }
  ]
};
const qa = P.evaluateDayCompletenessQa(sparse, {
  planningRole: 'middle',
  payload: { travelStyle: 'trendy', customWishes: '' }
});
assert(qa.severe === true, 'trendy sparse day still severe completeness');

console.log('\n=== Core adaptive: more candidates → lower core share ===');
const many = [];
for (let i = 0; i < 45; i++) {
  many.push(
    SE.createCandidate({
      id: 'c' + i,
      title: 'Place ' + i,
      destinationKey: 'MegaCity',
      categories: i % 3 === 0 ? ['design_retail'] : ['cafe'],
      landmarkClass: i < 5 ? 'core' : 'none'
    })
  );
}
const shareMega = SE.getCoreLandmarkSoftShare('trendy', 45);
const shareSmall = SE.getCoreLandmarkSoftShare('trendy', 8);
assert(shareMega < shareSmall, 'mega core share < small (' + shareMega + ' < ' + shareSmall + ')');

console.log('\n==== PHASE1 RESULT passed=' + passed + ' failed=' + failed + ' ====');

console.log('\n=== Regression: day-completeness + p0-2 flight middle ===');
function run(script) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    encoding: 'utf8',
    cwd: root
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  assert(ok, script + ' exit 0');
  if (!ok) console.error(out.slice(-800));
  return ok;
}
run('test-day-completeness-middle-flight.mjs');
run('test-p0-2-with-info.mjs');

console.log('\n==== TOTAL passed=' + passed + ' failed=' + failed + ' ====');
if (failed) process.exit(1);
