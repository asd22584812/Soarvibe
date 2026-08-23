/**
 * P0.4 — Featured bottom nav + Share destination taxonomy UX
 * Offline only. node scripts/test-p0-4-featured-nav-share-destination.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

const index = readFileSync(join(root, 'index.html'), 'utf8');
const uiSrc = readFileSync(join(root, 'city-shares-ui.js'), 'utf8');
const locSrc = readFileSync(join(root, 'city-shares-location.js'), 'utf8');
const featuredJs = readFileSync(join(root, 'featured-partners.js'), 'utf8');

console.log('\n=== CASE 10 Featured nav placement ===');
assert(!/data-affiliate-type="featured"/.test(index), 'featured NOT in homepage tool panel');
assert(/id="nav-featured"/.test(index), 'featured YES in bottom nav');
assert(/id="nav-home"/.test(index) && /id="nav-search"/.test(index) && /id="nav-favorite"/.test(index) && /id="nav-profile"/.test(index), 'bottom nav keeps Home/Search/Favorite/Profile');
assert(/navFeatured\.addEventListener|nav-featured[\s\S]{0,200}openFeaturedModal/.test(index), 'bottom nav opens featured modal');
assert(/function openFeaturedModal|openFeaturedModal:/.test(featuredJs), 'featured modal reusable');
assert(/nav-featured[\s\S]{0,80}nav-active|#nav-featured\.nav-active/.test(index), 'featured active state CSS');

console.log('\n=== load location + ui test hooks ===');
const sandbox = {
  console,
  window: {},
  globalThis: {},
  document: {
    readyState: 'complete',
    getElementById: () => null,
    addEventListener() {},
    createElement: () => ({ style: {}, setAttribute() {}, classList: { add() {}, remove() {} } })
  },
  localStorage: { getItem() { return null; }, setItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {} },
  location: { hash: '', href: 'https://soarvibe.local/' },
  history: { replaceState() {} },
  firebase: undefined,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  resolveCurrentCity: () => '東京'
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.global = sandbox;
vm.runInNewContext(locSrc, sandbox, { filename: 'city-shares-location.js' });
vm.runInNewContext(uiSrc, sandbox, { filename: 'city-shares-ui.js' });
const loc = sandbox.SOARVIBE_CITY_SHARES_LOCATION;
const ui = sandbox.SOARVIBE_CITY_SHARES_UI_TEST;
assert(!!loc && !!ui, 'modules loaded');

function resolveHomepage(text) {
  return loc.resolveLocation(text, { source: 'itinerary' });
}

console.log('\n=== CASE 1 Homepage Tokyo prefill editable ===');
{
  ui.resetComposeForTest();
  sandbox.resolveCurrentCity = () => '東京';
  const tax = resolveHomepage('東京');
  assert(tax.countryId === 'japan' && tax.cityId === 'tokyo', 'Tokyo → JP/tokyo');
  // simulate prepareComposeTaxonomy path
  ui.resetComposeForTest();
  const state = ui.getState();
  state.composeTaxonomy = Object.assign({}, tax);
  state.composeLocked = false;
  state.composeNeedsCountry = true;
  state.composeNeedsCity = true;
  state.composeDraft = {
    countryId: tax.countryId,
    cityId: tax.cityId,
    cityName: tax.cityName,
    cityQuery: tax.cityName
  };
  const html = ui.renderComposeLocationBlock();
  assert(/csComposeCountryId/.test(html) && /<select/.test(html), 'country select present');
  assert(/csComposeCityQuery/.test(html), 'region input present');
  assert(!/is-locked/.test(html), 'NOT locked');
  assert(!/東京・日本/.test(html), 'no locked summary chip 東京・日本');
  assert(/value="tokyo"|東京/.test(html) && /japan|日本/.test(html), 'prefilled Tokyo/Japan');
}

console.log('\n=== CASE 2 change region to Osaka ===');
{
  const tax = loc.resolveLocation('大阪', { countryId: 'japan', source: 'search' });
  const canon = loc.toCanonicalTaxonomy(tax);
  assert(canon.countryCode === 'JP' && canon.regionKey === 'osaka' && canon.regionName === '大阪', 'publish taxonomy JP/osaka');
}

console.log('\n=== CASE 3 Homepage Shanghai ===');
{
  const tax = resolveHomepage('上海');
  assert(tax.countryId === 'china' && tax.cityId === 'shanghai', 'Shanghai → CN/shanghai');
  const canon = loc.toCanonicalTaxonomy(tax);
  assert(canon.countryCode === 'CN' && canon.regionKey === 'shanghai', 'canonical CN/shanghai');
}

console.log('\n=== CASE 4 custom region 弘前 ===');
{
  const tax = loc.resolveLocation('弘前', { countryId: 'japan', source: 'manual' });
  assert(tax.countryId === 'japan' && tax.cityName === '弘前' && !!tax.cityId, 'custom 弘前 allowed under Japan');
  assert(tax.cityId !== 'tokyo' && tax.cityId !== 'osaka', 'custom id not colliding with known cities');
}

console.log('\n=== CASE 5 Korea suggestions + custom ===');
{
  const sug = loc.listCitySuggestions('korea', '');
  const names = sug.map((c) => c.cityName).join(',');
  assert(/首爾/.test(names) && /釜山/.test(names) && /濟州/.test(names), 'Korea suggestions include Seoul/Busan/Jeju');
  const custom = loc.resolveLocation('江陵', { countryId: 'korea', source: 'manual' });
  assert(custom.countryId === 'korea' && custom.cityName === '江陵', 'custom 江陵 allowed');
}

console.log('\n=== CASE 6 Japan → Korea clears Tokyo ===');
{
  assert(loc.regionBelongsToCountry('東京', 'japan') === true, 'Tokyo belongs Japan');
  assert(loc.regionBelongsToCountry('東京', 'korea') === false, 'Tokyo NOT valid under Korea');
  assert(loc.regionBelongsToCountry('tokyo', 'korea') === false, 'tokyo id NOT under Korea');
}

console.log('\n=== CASE 7/8 feed filter isolation ===');
{
  const tokyoScope = ui.buildScopeFromEntryId('tokyo');
  const osakaScope = ui.buildScopeFromEntryId('osaka');
  const posts = [
    { postId: '1', cityId: 'tokyo', countryId: 'japan', cityName: '東京', locationRaw: '東京・日本' },
    { postId: '2', cityId: 'osaka', countryId: 'japan', cityName: '大阪' },
    { postId: '3', cityId: 'kyoto', countryId: 'japan', cityName: '京都' },
    { postId: '4', cityId: 'seoul', countryId: 'korea', cityName: '首爾' },
    { postId: '5', cityId: 'shanghai', countryId: 'china', cityName: '上海' },
    { postId: '6', cityId: '', countryId: '', locationRaw: '東京・日本' }
  ];
  const tokyoHits = posts.filter((p) => ui.postMatchesScope(Object.assign({}, p), tokyoScope));
  const osakaHits = posts.filter((p) => ui.postMatchesScope(Object.assign({}, p), osakaScope));
  assert(tokyoHits.every((p) => p.cityId === 'tokyo' || p.postId === '6'), 'Tokyo filter only Tokyo (+ legacy normalize)');
  assert(!tokyoHits.some((p) => p.cityId === 'osaka' || p.cityId === 'kyoto' || p.cityId === 'seoul' || p.cityId === 'shanghai'), 'Tokyo filter excludes Osaka/Kyoto/Seoul/Shanghai');
  assert(osakaHits.every((p) => p.cityId === 'osaka'), 'Osaka filter only Osaka');
  assert(!osakaHits.some((p) => p.cityId === 'tokyo'), 'Osaka filter excludes Tokyo');
}

console.log('\n=== CASE 9 legacy normalize ===');
{
  const legacy = { locationRaw: '東京・日本' };
  const canon = loc.normalizePostDestination(legacy);
  assert(canon.countryCode === 'JP' && (canon.regionKey === 'tokyo' || legacy.cityId === 'tokyo'), 'legacy 東京・日本 → JP/tokyo');
  const legacy2 = loc.normalizePostDestination({ location: '日本 / 大阪' });
  assert(legacy2.countryCode === 'JP' && legacy2.regionKey === 'osaka', 'legacy 日本 / 大阪 → JP/osaka');
}

console.log('\n=== no itinerary architecture touch ===');
assert(!/buildGeminiHumanRealismBlock|auditGeminiItinerary|planHiddenItineraryAsync/.test(uiSrc), 'city-shares-ui has no itinerary architecture');
assert(!/buildGeminiTripMemoryBlock/.test(uiSrc + locSrc), 'location module has no Gemini trip memory');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
