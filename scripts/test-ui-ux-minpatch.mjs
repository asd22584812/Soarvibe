/**
 * Minimal UI/UX patch regressions (offline).
 * node scripts/test-ui-ux-minpatch.mjs
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

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const featuredCss = fs.readFileSync(path.join(root, 'featured-partners.css'), 'utf8');
const featuredJs = fs.readFileSync(path.join(root, 'featured-partners.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
const plannerSrc = fs.readFileSync(path.join(root, 'itinerary-planner-v2.js'), 'utf8');
const styleSrc = fs.readFileSync(path.join(root, 'itinerary-style-engine.js'), 'utf8');

console.log('\n=== A/B/C homepage share entry ===');
assert(/看看大家怎麼玩，也分享你的旅程/.test(index), 'A new homepage title');
assert(/真實旅人分享・景點・美食・住宿靈感/.test(index), 'A subtitle present');
assert(!/還沒規劃去哪嗎？跟著 SoarVibe 這樣玩/.test(index), 'old title removed');
assert(/id="mag-city-list"/.test(index) && /aria-label="城市旅人分享推薦"/.test(index), 'B city cards list retained');
assert(/id="cityShares"/.test(index) && /分享這次旅行/.test(index), 'C share compose chrome retained');
assert(/openCompose|composeLocked|csCloseBtn/.test(uiJs + index), 'C share UI functions still present');

console.log('\n=== D/E/F/G Featured black area ===');
assert(/#soarvibeFeatured\s*\{[^}]*position:\s*fixed/s.test(featuredCss), 'D fixed overlay');
assert(/#soarvibeFeatured\s*\{[^}]*inset:\s*0/s.test(featuredCss), 'D inset 0');
assert(/min-height:\s*100dvh/.test(featuredCss) && /var\(--soarvibe-vh/.test(featuredCss), 'D covers 100dvh / soarvibe-vh');
assert(/featured-viewport[\s\S]*overflow-y:\s*auto/.test(featuredCss), 'E scroll container');
assert(/safe-area-inset-bottom/.test(featuredCss), 'E safe-area bottom');
assert(/#soarvibeFeatured\s*\{[^}]*background:\s*#f7fbfb/s.test(featuredCss), 'D Featured overlay paints light bg (not body #000)');
assert(/overflow-only|Overflow-only|position:fixed/.test(featuredJs) && !/backgroundColor = '#f7fbfb'/.test(featuredJs), 'D lockBodyScroll avoids body bg swap (seamless close)');
assert(/requestAnimationFrame/.test(featuredJs) && /unlockBodyScroll/.test(featuredJs), 'D close unlocks before hide to avoid flash');
assert(/featuredCloseBtn|featured-close/.test(index + featuredJs), 'F close button retained');
assert(/isSafeHttpUrl|window\.open|partner\.url/.test(featuredJs), 'G external banner links retained');
assert(!/featuredPartners\s*=\s*\[/.test(featuredJs) || /FEATURED_PARTNERS_PRODUCTION/.test(featuredJs), 'G data structure array retained');

console.log('\n=== H–N transportation ===');
assert(/交通方式＊/.test(index), 'H label required asterisk');
assert(/請選擇交通方式/.test(index), 'H placeholder');
assert(!/value="soarvibe-decide"/.test(index), 'L decide option removed');
assert(/value="public-transit"/.test(index) && /value="self-drive"/.test(index), 'options: transit + self-drive');
assert(!/value="taxi-charter"/.test(index) && !/value="walk-transit"/.test(index) && !/value="mixed"/.test(index), 'legacy options removed');
assert(/isTransportSelected\(\)/.test(index) && /showTransportRequiredHint/.test(index), 'I validation helpers');
assert(/請先選擇這趟旅行的交通方式/.test(index), 'I field hint copy');
assert(/if \(!isTransportSelected\(\)\)/.test(index), 'I generate blocks without transport');
assert(!/advancedTransportSelect\.value = 'public-transit'/.test(index), 'N no auto public-transit default');
assert(!/advancedTransportSelect\.value = pickRandom\(preset\.transports\)/.test(index), 'H no preset auto transport');
assert(/未選擇（禁止生成）/.test(index) || /禁止假設自駕/.test(index), 'M empty ≠ drive');
assert(/必須由使用者明確選擇大眾運輸或自駕/.test(index), 'M/N empty requires explicit choice');
assert(!/未指定（靈感模式）/.test(index), 'N removed empty→transit inspiration default');

// Prompt wiring smoke via vm
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(path.join(root, 'travel-time-engine.js'));
require(path.join(root, 'itinerary-destination-intelligence.js'));
require(path.join(root, 'itinerary-style-engine.js'));
const E = globalThis.SOARVIBE_TRAVEL_TIME_ENGINE;
const SE = globalThis.SOARVIBE_STYLE_ENGINE;

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
  TRANSPORT_LABELS: {
    'public-transit': '大眾運輸',
    'self-drive': '自駕',
    'taxi-charter': '包車・計程車為主',
    'walk-transit': '步行＋大眾運輸',
    mixed: '混合交通',
    'soarvibe-decide': '✨ 交給 SoarVibe 判斷'
  },
  TRANSPORT_MODE_EMPTY: '',
  TRANSPORT_MODE_DECIDE: 'soarvibe-decide',
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
  'hasHardFlightData',
  'buildGeminiPlannerPersonaBlock',
  'buildGeminiHumanRealismBlock',
  'buildGeminiShortTransitCompressionBlock',
  'buildGeminiTimeConsistencySelfCheckBlock',
  'buildGeminiTripLevelSelfCheckBlock',
  'buildGeminiTripMemoryBlock',
  'buildGeminiDayCompletenessBlock',
  'buildGeminiTimingRulesBlock',
  'buildGeminiStyleInstruction',
  'ensurePayloadDiscovery',
  'buildGeminiCandidateBoundBlock',
  'annotateCandidateBoundDayQa',
  'buildGeminiKoreaNameBlock',
  'buildGeminiJsonOutputBlock',
  'buildGeminiTransportInstructionBlock',
  'buildTransportModeLine',
  'buildGeminiStyleBlocks',
  'buildGeminiFlightLogicBlock',
  'buildGeminiRequestText',
  'buildGeminiSingleDayRequestText'
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

const base = {
  destination: '札幌',
  dateStart: '2026-11-24',
  dateEnd: '2026-11-29',
  travelStyle: 'sightseeing',
  customWishes: '',
  customerSelectedTransport: '',
  transport: ''
};

const emptyP = attach({ ...base });
const emptyPrompt = sandbox.buildGeminiRequestText(emptyP);
assert(/未選擇（禁止生成）|禁止假設自駕/.test(emptyPrompt), 'M empty prompt forbids drive default');
assert(!/請以當地合理大眾運輸/.test(emptyPrompt), 'N empty does not default to transit wording');

const transitP = attach({
  ...base,
  transport: 'public-transit',
  customerSelectedTransport: '大眾運輸'
});
const transitPrompt = sandbox.buildGeminiRequestText(transitP);
assert(/USER HARD/.test(transitPrompt) && /大眾運輸/.test(transitPrompt), 'J transit generates instruction');

const driveP = attach({
  ...base,
  transport: 'self-drive',
  customerSelectedTransport: '自駕'
});
const drivePrompt = sandbox.buildGeminiRequestText(driveP);
assert(/自駕/.test(drivePrompt) && /USER HARD/.test(drivePrompt), 'K self-drive generates instruction');

const decideP = attach({
  ...base,
  transport: 'soarvibe-decide',
  customerSelectedTransport: '✨ 交給 SoarVibe 判斷'
});
const decidePrompt = sandbox.buildGeminiRequestText(decideP);
assert(/未選擇（禁止生成）|必須由使用者明確選擇大眾運輸或自駕/.test(decidePrompt), 'L legacy decide rejected as unselected');
assert(/禁止假設自駕/.test(decidePrompt) && /禁止假設大眾運輸/.test(decidePrompt), 'L decide no silent defaults');

console.log('\n=== O/P architecture ===');
assert(/auditGeminiItinerary/.test(index), 'O planner audit path');
assert(SE.canCreateContent === false, 'O style cannot create');
assert(!/secondGemini|geminiCorrection|repromptGemini/.test(index), 'P no second Gemini call');
assert(!/planHiddenItineraryAsync\s*\(\s*resolved/.test(index), 'O no planner inject live');
assert(!/appendFallbackAttraction|injectShopping/.test(index + plannerSrc + styleSrc), 'O no backend inject');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
