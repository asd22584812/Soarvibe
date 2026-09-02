/**
 * City Shares: no demo seed feed + pull-to-refresh regressions.
 * node scripts/test-city-shares-no-seed-ptr.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  OK  ' + msg);
    passed += 1;
  } else {
    console.error('  FAIL  ' + msg);
    failed += 1;
  }
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = fs.readFileSync(path.join(root, 'city-shares-data.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'city-shares-firestore.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'city-shares-ui.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

console.log('\n=== no demo / seed feed ===');
assert(!/city-shares-demo-seeds\.js/.test(index), 'demo-seeds not loaded in index.html');
assert(!/city-shares-demo-seeds\.js/.test(sw), 'demo-seeds not in service-worker precache');
assert(/tokyo-hero-kaminarimon\.jpg/.test(data), 'Tokyo hero retained');
assert(/posts:\s*\[\s*\]/.test(data), 'Tokyo local posts array empty');
assert(!/tokyo-sensoji-001/.test(data), 'sensoji seed removed from data');
assert(!/tokyo-nakano-broadway-001/.test(data), 'nakano seed removed from data');
assert(
  /Firestore-only: never merge local official\/demo seeds/.test(ui) ||
    /never merge local official\/demo seeds/.test(ui),
  'getPosts does not merge local seeds'
);
assert(!/getCityShares\(seedKey\)/.test(ui), 'getPosts no longer calls getCityShares');
assert(/還沒有旅人分享/.test(ui) && /成為第一個分享這趟旅程的人/.test(ui), 'empty state copy');
assert(/createdAt DESC|createdAt', 'desc'|orderBy\('createdAt', 'desc'\)/.test(api), 'query createdAt DESC');
assert(!/orderBy\('publishedAt'/.test(api), 'no publishedAt orderBy this round');

console.log('\n=== pull-to-refresh ===');
assert(/function bindPullToRefresh/.test(ui), 'PTR binder exists');
assert(/function runFeedPullRefresh/.test(ui), 'PTR refresh runner exists');
assert(/scrollTop > 0/.test(ui) && /PTR_THRESHOLD/.test(ui), 'PTR gated on scrollTop + threshold');
assert(/PTR_RESISTANCE/.test(ui), 'PTR uses resistance (not 1:1)');
assert(!/location\.reload\(\);/.test(ui), 'PTR refresh does not location.reload');
assert(/Guest-allowed: only refreshRemoteFeed/.test(ui), 'guest PTR — no login gate');
assert(/keptFilter/.test(ui) && /csState\.typeFilter = keptFilter/.test(ui), 'PTR keeps category filter');
assert(/csState\.cityId = cityId/.test(ui), 'PTR keeps city');
assert(
  /csState\.remotePosts = priorRemote/.test(ui) &&
    /Failure \/ timeout \/ exception must keep the current DOM/.test(ui) &&
    /更新失敗，請稍後再試/.test(ui),
  'PTR failure keeps existing feed + toast, no rebuild'
);
assert(/function patchFeedAfterRefresh/.test(ui) && /Keep hero/.test(ui), 'PTR success patches cards, not whole feed DOM');
assert(/throwOnError:\s*true/.test(ui), 'PTR treats fetch errors as failure (not empty success)');
assert(/function finishPtrRefresh/.test(ui), 'PTR finish helper resets spinner/transform');
assert(/PTR_MIN_MS = 400/.test(ui) && /PTR_TIMEOUT_MS = 7000/.test(ui), 'PTR min 400ms and 7s safety timeout');
assert(/finishPtrRefresh\(\)/.test(ui.slice(ui.indexOf('function runFeedPullRefresh'))), 'PTR always calls finishPtrRefresh');
assert(/\.cs-ptr/.test(css) && /cs-ptr-spin/.test(css), 'PTR indicator styles present');
assert(!/重新整理<\/button>/.test(ui), 'no fixed refresh toolbar button');

console.log('\n=== loading / empty / error ===');
assert(/正在載入旅人們的最新分享/.test(ui), 'initial load shows loading copy');
assert(/cs-feed-loading-copy/.test(ui) && /cs-feed-loading-spinner/.test(css), 'lightweight loading spinner styles');
assert(/phase === 'loading'/.test(ui) && /phase === 'error'/.test(ui), 'loading vs error phases');
assert(/feedLoadPhase = 'ready'/.test(ui), 'loaded phase clears loading');
assert(
  /phase === 'loading'[\s\S]*cs-feed-loading[\s\S]*if \(!posts\.length\)[\s\S]*還沒有旅人分享/.test(ui),
  'empty state is separate branch from loading'
);
assert(/cs-feed-error/.test(ui) && /data-cs-retry/.test(ui), 'query failure uses error + retry, not endless skeleton');

console.log('\n=== runtime sandbox: getPosts Firestore-only ===');
const sandbox = {
  window: {},
  console,
  setTimeout,
  clearTimeout,
  document: {
    readyState: 'complete',
    getElementById: () => null,
    addEventListener: () => {}
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(data, sandbox, { filename: 'city-shares-data.js' });
assert(sandbox.getCityShares('tokyo').length === 0, 'getCityShares(tokyo) empty');
assert(!sandbox.getCityShareById('tokyo-sensoji-001'), 'seed id not resolvable');
assert(
  sandbox.SOARVIBE_CITY_SHARES.cities.tokyo.heroImage.includes('tokyo-hero-kaminarimon'),
  'hero meta still on tokyo city'
);

// Minimal stub so UI IIFE can load without Firebase DOM
sandbox.SOARVIBE_FEATURE_FLAGS = { CITY_SHARES_ENABLED: true };
sandbox.SOARVIBE_CITY_SHARES_LOCATION = null;
sandbox.SOARVIBE_CITY_SHARES_CARDS = null;
sandbox.SOARVIBE_CITY_SHARES_API = null;
sandbox.SOARVIBE_AUTH = null;
sandbox.firebase = undefined;
sandbox.AbortController = function () {};
vm.runInNewContext(ui, sandbox, { filename: 'city-shares-ui.js' });
const testApi = sandbox.SOARVIBE_CITY_SHARES_UI_TEST;
assert(!!testApi && typeof testApi.getPosts === 'function', 'UI test hooks expose getPosts');
const st = testApi.getState();
st.feedScope = { feedKind: 'city', cityId: 'tokyo', entryId: 'tokyo' };
st.cityId = 'tokyo';
st.remotePosts = [
  {
    postId: 'av9x1FTG4NlYBDLoXp97',
    cityId: 'tokyo',
    status: 'published',
    source: 'user',
    type: 'sightseeing',
    title: '好好好吃',
    createdAt: { toMillis: () => 2000 }
  },
  {
    postId: 'older-user',
    cityId: 'tokyo',
    status: 'published',
    source: 'user',
    type: 'anime',
    title: '舊文',
    createdAt: { toMillis: () => 1000 }
  }
];
const all = testApi.getPosts('tokyo', 'all');
assert(all.length === 2 && all[0].postId === 'av9x1FTG4NlYBDLoXp97', 'new published post sorts first (createdAt DESC)');
st.typeFilter = 'anime';
const filtered = testApi.getPosts('tokyo', 'anime');
assert(filtered.length === 1 && filtered[0].type === 'anime', 'category filter works');
assert(st.cityId === 'tokyo' && st.typeFilter === 'anime', 'city + category state retained');
st.typeFilter = 'all';
st.remotePosts = [];
st.feedLoadPhase = 'loading';
const loadingHtml = testApi.renderFeedCardsHtml('tokyo');
assert(
  /正在載入旅人們的最新分享/.test(loadingHtml) && !/還沒有旅人分享/.test(loadingHtml),
  'initial load shows loading copy; empty not mixed'
);
st.feedLoadPhase = 'ready';
const emptyHtml = testApi.renderFeedCardsHtml('tokyo');
assert(
  /還沒有旅人分享/.test(emptyHtml) && !/正在載入旅人們的最新分享/.test(emptyHtml),
  'loaded empty state without loading copy'
);
st.feedLoadPhase = 'error';
const errHtml = testApi.renderFeedCardsHtml('tokyo');
assert(/再試一次/.test(errHtml) && !/正在載入旅人們的最新分享/.test(errHtml), 'error state not mixed with loading');
assert(typeof testApi.finishPtrRefresh === 'function', 'refresh success/fail/exception/timeout share finishPtrRefresh');
assert(testApi.PTR_MIN_MS === 400 && testApi.PTR_TIMEOUT_MS === 7000, 'PTR min 400ms, timeout 7s');
testApi.finishPtrRefresh();
assert(testApi.getState(), 'finishPtrRefresh safe with missing DOM (spinner reset path)');

console.log('\n=== syntax ===');
['city-shares-ui.js', 'city-shares-data.js', 'city-shares-firestore.js'].forEach((file) => {
  const r = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert(r.status === 0, file + ' syntax');
});

console.log('\n=== totals ===');
console.log('passed=' + passed + ' failed=' + failed);
process.exit(failed ? 1 : 0);
