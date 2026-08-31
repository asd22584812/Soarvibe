/**
 * Mobile UX forensic fixes regression (offline).
 * node scripts/test-mobile-ux-v198.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const ui = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'city-shares-ui.css'), 'utf8');

console.log('\n=== 1–2 departure evening / airport overlap ===');
assert(
  /function dayAlreadyHasAirportOrDepartureActivity/.test(index),
  '1. airport/departure activity detector exists'
);
assert(
  /if \(!dayAlreadyHasAirportOrDepartureActivity\(day\)\)/.test(index),
  '1b. last-day evening inject gated on airport presence'
);
assert(
  /整理行李・前往機場/.test(index) &&
    index.indexOf('dayAlreadyHasAirportOrDepartureActivity') <
      index.indexOf('整理行李・前往機場'),
  '1c. synthetic evening airport still exists for empty last days without airport'
);
assert(
  /if \(!phaseItems\.length\) return;/.test(index),
  '1d. empty phase headers skipped in app itinerary render'
);
assert(
  !/completeness.*evening.*inject|forceEvening/.test(index.slice(0, 500)),
  '1e. no completeness evening force marker in early bootstrap (sanity)'
);

console.log('\n=== 3–4 City Shares open / images ===');
assert(/cs-skeleton-grid/.test(ui) && /cs-skeleton-card/.test(ui), '3. open paints skeleton markup');
assert(/cs-skeleton-grid/.test(css) && /cs-skeleton-shimmer/.test(css), '3b. skeleton CSS present');
assert(
  /Paint shell immediately|never leave a blank white panel/.test(ui),
  '3c. immediate shell comment/path present'
);
assert(
  !/viewport\.innerHTML = '<div class="cs-page"><p class="cs-empty">載入分享中…<\/p><\/div>'/.test(ui),
  '3d. blank-only loading empty removed'
);
assert(/loading="lazy"/.test(ui) && /decoding="async"/.test(ui), '4. images lazy/async');
assert(
  /img\.replaceWith|cs-card-placeholder/.test(ui),
  '4b. individual image error handled without blocking feed'
);

console.log('\n=== 5–8 like state / no full rerender ===');
assert(
  /whenAuthReady\(\)\.then\(runQueries\)/.test(ui) ||
    /whenAuthReady\(\)\.then\(runQueries\)\.catch\(runQueries\)/.test(ui),
  '5. loadDetailExtras waits for auth before hasLiked'
);
assert(/function patchLikeUi\(/.test(ui), '7. patchLikeUi exists');
assert(
  /toggleLike\(csState\.postId\)[\s\S]*?patchLikeUi\(\)/.test(ui) &&
    !/toggleLike\(csState\.postId\)[\s\S]*?\.then\(function \(res\) \{[\s\S]*?renderCurrentView\(\)/.test(
      ui.slice(ui.indexOf('function handleLike'), ui.indexOf('function handleSave'))
    ),
  '7b. handleLike patches UI instead of full renderCurrentView'
);
assert(/function patchDetailSocialFromExtras\(/.test(ui), '5b. detail extras patch path');
assert(
  /alreadyPainted && document\.getElementById\('csLikeBtn'\)/.test(ui),
  '8. open detail avoids full rerender when already painted'
);

console.log('\n=== 9–12 removed / retained UI ===');
assert(!/id="csSaveBtn"/.test(ui), '9. ☆ 收藏 button not rendered');
assert(!/id="csComposeBtn"/.test(ui), '10. article-detail ＋ 分享投稿 not rendered');
assert(/id="csLikeBtn"/.test(ui), '11. ♡ 按讚 retained');
assert(/id="csCommentFocusBtn"/.test(ui) && /id="csCommentForm"/.test(ui), '11b. comments retained');
assert(/id="csDeletePostBtn"/.test(ui), '11c. delete-own-post retained');
assert(/id="csComposeOpenBtn"/.test(ui) && /分享這次旅行/.test(ui), '12. feed create entry retained');
assert(
  /e\.target\.id === 'csComposeOpenBtn'[\s\S]*openCompose\(\)/.test(ui) &&
    !/e\.target\.id === 'csComposeBtn'/.test(ui),
  '12b. compose click only on feed primary entry'
);

console.log('\n=== totals ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
