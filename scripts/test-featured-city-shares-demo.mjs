/**
 * Offline verify: Featured 3 demos + City Shares 21 demo posts.
 * node scripts/test-featured-city-shares-demo.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const featuredJs = fs.readFileSync(path.join(root, 'featured-partners.js'), 'utf8');
const demoSeeds = fs.readFileSync(path.join(root, 'city-shares-demo-seeds.js'), 'utf8');
const dataJs = fs.readFileSync(path.join(root, 'city-shares-data.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');

console.log('\n=== Featured Tokyo demos ===');
assert(!/Partner A|Partner B|TEST Partner/i.test(featuredJs.match(/FEATURED_PARTNERS_PRODUCTION[\s\S]*?\];/)?.[0] || ''), 'no Partner A/B in production');
assert(/DEMO・合作版位示意/.test(featuredJs), 'DEMO label');
assert(/tokyo-experiences-demo/.test(featuredJs) && /tokyo-esim-demo/.test(featuredJs) && /tokyo-airport-demo/.test(featuredJs), '3 demo ids');
assert(/ctaLabel/.test(featuredJs) && /deepLink/.test(featuredJs) && /universalLink/.test(featuredJs), 'link fields');
assert(/openPartnerLink/.test(featuredJs), 'deep link opener');
assert(fs.existsSync(path.join(root, 'assets/featured/tokyo-experiences-demo.svg')), 'experiences svg');
assert(fs.existsSync(path.join(root, 'assets/featured/tokyo-esim-demo.svg')), 'esim svg');
assert(fs.existsSync(path.join(root, 'assets/featured/tokyo-airport-demo.svg')), 'airport svg');
assert(/查看東京體驗/.test(featuredJs) && /查看 eSIM 方案/.test(featuredJs) && /查看機場交通/.test(featuredJs), 'CTAs');

console.log('\n=== City Shares wiring ===');
assert(/city-shares-demo-seeds\.js/.test(index), 'demo seeds script wired');
assert(/busan: \{ name: '釜山'/.test(uiJs), 'busan label');
assert(/shareOpenGeneration/.test(uiJs), 'race guard still present');

const sandbox = { console, window: {}, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(dataJs, sandbox, { filename: 'city-shares-data.js' });
vm.runInNewContext(demoSeeds, sandbox, { filename: 'city-shares-demo-seeds.js' });

const DATA = sandbox.SOARVIBE_CITY_SHARES;
const tokyoBefore = (DATA.cities.tokyo.posts || []).length;
assert(tokyoBefore >= 3, 'tokyo posts preserved (' + tokyoBefore + ')');
assert(typeof sandbox.getCityShares === 'function', 'getCityShares');

const cities = ['kyoto', 'osaka', 'seoul', 'busan', 'hokkaido', 'bangkok', 'vietnam'];
let total = 0;
cities.forEach((id) => {
  const list = sandbox.getCityShares(id);
  assert(list.length === 3, id + ' has 3 readable posts (got ' + list.length + ')');
  total += list.length;
  list.forEach((p) => {
    assert(p.media && p.media[0] && p.media[0].src, id + ' ' + p.postId + ' has media');
    assert(fs.existsSync(path.join(root, p.media[0].src.replace(/^\.\//, ''))), id + ' media file exists');
    assert(p.body && p.body.length >= 80, id + ' body long enough');
    assert(p.title && !/百科|Wiki/i.test(p.title), id + ' traveler title');
  });
  const types = new Set(list.map((p) => p.type));
  assert(types.size >= 2, id + ' theme diversity');
});
assert(total === 21, '21 demo posts total');

// detail lookup
const sample = sandbox.getCityShareById('kyoto-gion-stroll-001');
assert(!!sample && sample.cityId === 'kyoto', 'detail lookup works');
assert(!!sandbox.getCityShareById('tokyo-sensoji-001'), 'tokyo detail still works');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
