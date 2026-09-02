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
assert(!/city-shares-demo-seeds\.js/.test(index), 'demo seeds script NOT wired in production index');
assert(/busan: \{ name: '釜山'/.test(uiJs), 'busan label');
assert(/shareOpenGeneration/.test(uiJs), 'race guard still present');
assert(/還沒有旅人分享/.test(uiJs), 'empty state present');
assert(/function runFeedPullRefresh/.test(uiJs), 'pull-to-refresh present');

const sandbox = { console, window: {}, globalThis: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(dataJs, sandbox, { filename: 'city-shares-data.js' });

const DATA = sandbox.SOARVIBE_CITY_SHARES;
assert((DATA.cities.tokyo.posts || []).length === 0, 'tokyo local seed posts empty');
assert(/tokyo-hero-kaminarimon/.test(DATA.cities.tokyo.heroImage || ''), 'tokyo hero retained');
assert(typeof sandbox.getCityShares === 'function', 'getCityShares');
assert(sandbox.getCityShares('tokyo').length === 0, 'getCityShares(tokyo) empty for feed');
assert(!sandbox.getCityShareById('tokyo-sensoji-001'), 'official seed ids gone from data');

// Demo seed file may still exist on disk but must not be production-mounted.
assert(fs.existsSync(path.join(root, 'city-shares-demo-seeds.js')), 'demo seeds file kept offline only');
vm.runInNewContext(demoSeeds, sandbox, { filename: 'city-shares-demo-seeds.js' });
const cities = ['kyoto', 'osaka', 'seoul', 'busan', 'hokkaido', 'bangkok', 'vietnam'];
cities.forEach((id) => {
  const list = sandbox.getCityShares(id);
  assert(list.length === 3, 'offline demo file still has ' + id + ' samples (not production feed)');
});

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
