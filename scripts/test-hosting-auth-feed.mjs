/**
 * Regression: Hosting API origin, backup city binding, City Shares feed sort helpers.
 * Run: node --test scripts/test-hosting-auth-feed.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Worker ALLOWED_ORIGINS includes Firebase Hosting domains', () => {
  const toml = read('worker/wrangler.toml');
  assert.match(toml, /soarvibe-885c8\.web\.app/);
  assert.match(toml, /soarvibe-885c8\.firebaseapp\.com/);
  const src = read('worker/src/index.js');
  assert.match(src, /soarvibe-885c8\.web\.app/);
});

test('Firebase authDomain stays on web.app (do not regress Google Auth)', () => {
  const cfg = read('firebase-config.js');
  assert.match(cfg, /authDomain:\s*'soarvibe-885c8\.web\.app'/);
});

test('Tokyo API failure must not pick Hokkaido/Sapporo backup pack', () => {
  const html = read('index.html');
  assert.match(html, /blocked wrong-city backup/);
  assert.match(html, /Explicit city aliases/);
  assert.doesNotMatch(html, /部分天數 AI 額度不足/);
  assert.doesNotMatch(html, /精選備援行程/);
  assert.match(html, /目前規劃服務較忙碌，請稍後再試一次/);
});

test('Maps Places panel has timeout and neutral error UX', () => {
  const html = read('index.html');
  assert.match(html, /MAPS_LOAD_TIMEOUT_MS/);
  assert.match(html, /gm_authFailure/);
  assert.match(html, /MSG_MAPS_UNAVAILABLE/);
  assert.match(html, /附近推薦暫時無法載入/);
});

test('KKday tickets keep single eSIM with original product + cid', () => {
  const html = read('index.html');
  assert.match(html, /KKDAY_CID = '25299'/);
  assert.match(html, /kkday\.com\/zh-tw\/product\/150285/);
  assert.match(html, /name: 'eSIM'/);
  assert.doesNotMatch(html, /即將開放.*eSIM|eSIM 方案即將開放/);
  assert.match(html, /'札幌': '北海道'/);
});

test('Accordion collapsed sub-panels hide padding and content', () => {
  const html = read('index.html');
  assert.match(html, /\.adv-sub-panel-inner\s*\{[^}]*visibility:\s*hidden/s);
  assert.match(html, /\.adv-sub\.is-open \.adv-sub-panel-inner\s*\{[^}]*visibility:\s*visible/s);
});

test('Flight advanced labels no longer show 選填', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /航班編號 <span class="field-optional">選填<\/span>/);
  assert.doesNotMatch(html, /交通方式 <span class="field-optional">選填<\/span>/);
  assert.doesNotMatch(html, /專屬許願池 <span class="field-optional">選填<\/span>/);
  assert.match(html, /還沒決定也沒關係，SoarVibe 會先以早去晚回幫你規劃/);
  assert.doesNotMatch(
    html,
    /以下為進階選填。未填也可生成靈感行程（早去晚回 Preview）/
  );
});

test('City Shares feed sorts by createdAt / publishedAt desc', () => {
  const ui = read('city-shares-ui.js');
  assert.match(ui, /function postSortTimeMs/);
  assert.match(ui, /tb - ta/);
  assert.match(ui, /MEDIA_MAX_PER_POST/);
});

test('City Shares media upload is feature-flagged off (no Storage path at runtime)', () => {
  const flags = read('feature-flags.js');
  assert.match(flags, /citySharesMediaUpload:\s*false/);
  assert.match(flags, /avatarUploadEnabled:\s*false/);
  const ui = read('city-shares-ui.js');
  assert.match(ui, /照片分享即將開放/);
  assert.match(ui, /mediaUploadEnabled\(\)/);
  const api = read('city-shares-firestore.js');
  assert.match(api, /function mediaUploadEnabled/);
  assert.match(api, /city-shares\/' \+ uid \+ '\/' \+ postId/);
  assert.match(api, /MEDIA_MAX_PER_POST/);
});

test('Composer chrome uses safe-area title slot', () => {
  const html = read('index.html');
  const css = read('city-shares-ui.css');
  assert.match(html, /id="csChromeTitle"/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /\.cs-chrome-title/);
  assert.match(css, /\.cs-compose-page/);
});

test('Service worker network-first for firebase config / auth / feature-flags', () => {
  const sw = read('service-worker.js');
  assert.match(sw, /soarvibe-v153/);
  assert.match(sw, /isRuntimeConfigAsset/);
  assert.match(sw, /firebase-config\\.js/);
  assert.match(sw, /feature-flags\\.js/);
});

test('BUILD is v153 and Gemini primary model is 2.5-flash only', () => {
  const html = read('index.html');
  assert.match(html, /SOARVIBE_APP_BUILD = 'v153'/);
  assert.match(html, /GEMINI_MODEL_IDS = \['gemini-2\.5-flash'\]/);
  const models = html.match(/GEMINI_MODEL_IDS\s*=\s*\[([^\]]+)\]/);
  assert.ok(models);
  assert.doesNotMatch(models[1], /gemini-2\.0-flash/);
});

test('User-facing copy avoids AI/fallback vendor jargon', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /精選備援/);
  assert.doesNotMatch(html, /額度不足/);
  assert.doesNotMatch(html, /混合 AI/);
  assert.doesNotMatch(html, /稍後重新生成以取得完整 AI/);
  assert.match(html, /目前規劃服務較忙碌，請稍後再試一次/);
});
