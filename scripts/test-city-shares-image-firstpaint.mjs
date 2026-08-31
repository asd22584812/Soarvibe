/**
 * City Shares image first-paint + detail CTA cleanup regressions.
 * node scripts/test-city-shares-image-firstpaint.mjs
 */
import fs from 'fs';
import path from 'path';
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

const ui = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'city-shares-ui.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

console.log('\n=== image first-paint ===');
assert(
  !/#cityShares\s+\.cs-media-carousel\s*\{[^}]*background:\s*#111/s.test(css) &&
    !/#cityShares\s+\.cs-media-slide\s*\{[^}]*background:\s*#111/s.test(css),
  '1. card media loading state is not pure black (#111)'
);
assert(
  /background:\s*linear-gradient\(135deg,\s*#eceff1/.test(css),
  '1b. light neutral placeholder gradient on media'
);
assert(
  /eager \? 'loading="eager" fetchpriority="high"/.test(ui) ||
    /loading="eager" fetchpriority="high"/.test(ui),
  '2. known image URL binds img src immediately with eager first slide'
);
assert(/eager:\s*idx\s*===\s*0/.test(ui), '3. first carousel image eager; rest lazy');
assert(
  /loading="lazy"/.test(ui) && /eager:\s*idx\s*===\s*0/.test(ui),
  '3b. non-first slides remain lazy (do not wait for all)'
);
assert(
  /cs-card-placeholder/.test(ui) && /照片暫時無法顯示|照片準備中/.test(ui),
  '4. image error has fallback placeholder'
);
assert(/opacity:\s*0/.test(css) && /\.cs-media-img\.is-loaded/.test(css), '4b. fade-in on load');
assert(/function bindMediaFadeIn/.test(ui), '4c. bindMediaFadeIn wires load/cached');

console.log('\n=== detail CTA cleanup ===');
assert(!/id="csPlanAiBtn"/.test(ui), '5. article detail does not render AI planning CTA');
assert(!/id="csAddTripBtn"/.test(ui), '6. article detail does not render add-to-itinerary CTA');
assert(!/用 AI 規劃含此景點/.test(ui), '5b. AI planning label gone from UI render');
assert(!/加入我的行程規劃/.test(ui), '6b. add-to-itinerary label gone from UI render');
assert(/送出留言/.test(ui) && /id="csCommentForm"/.test(ui), '7. send comment button still exists');
assert(/id="csLikeBtn"/.test(ui), '8. like retained');
assert(/id="csCommentFocusBtn"/.test(ui) && /id="csCommentInput"/.test(ui), '8b. comment retained');
assert(/id="csDeletePostBtn"/.test(ui), '8c. delete-own-post retained');
assert(/id="csComposeOpenBtn"/.test(ui) && /分享這次旅行/.test(ui), '9. + 分享這次旅行 retained');
assert(
  /function openCityShares/.test(ui) && /function renderCurrentView/.test(ui),
  '10. feed / detail opening paths retained'
);
assert(!/e\.target\.id === 'csPlanAiBtn'/.test(ui), '5c. AI CTA click handler removed');
assert(!/e\.target\.id === 'csAddTripBtn'/.test(ui), '6c. add-trip click handler removed');

console.log('\n=== utf8 / syntax ===');
assert(!/\uFFFD/.test(ui) && !/\uFFFD/.test(css), 'UTF-8 no U+FFFD in city-shares UI files');
assert(!/\uFFFD/.test(index), 'UTF-8 no U+FFFD in index.html');

const synUi = spawnSync(process.execPath, ['--check', path.join(root, 'city-shares-ui.js')], {
  encoding: 'utf8'
});
assert(synUi.status === 0, 'inline JS syntax: city-shares-ui.js');

console.log('\n=== totals ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
